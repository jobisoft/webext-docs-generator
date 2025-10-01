/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Author: John Bieling
 */

import * as tools from './modules/tools.mjs';
import { Writer } from './modules/writer.mjs';

import { promises as fs } from "fs";
import path from "path";

const TEMPLATE_PATH = `template`;
const HELP_SCREEN = `

Usage:

    node generate-docs.js <options>
    
Options:
   --schemas=path             - ...
                                ...
   --output=path              - Path of a folder to store the generated markdown
                                files. All existing files in that folder will be
                                deleted.
   --manifest_version         - ...
   --report_errors            - report errors in the schema files
`;

let ADDITIONAL_TYPE_PREFIXES = [];
const ADDITIONAL_TYPE_FILES = [
    "experiments.json",
    "extension_types.json",
    "manifest.json",
    "types.json",
    "events.json"
];

const TITLE_DATA = {
    "release": {
        prefix: "",
        slug: "",
    },
    "esr": {
        prefix: "ESR ",
        slug: "esr-",
    },
    "beta": {
        prefix: "Beta ",
        slug: "beta-",
    },
}

const config = tools.parseArgs();
if (!config.schemas || !config.output || !config.manifest_version) {
    console.log(HELP_SCREEN);
} else {
    // Clone template folder and adjust cloned files.
    const schemas = await tools.getSchemaFiles(config.schemas);
    const thunderbird_version = schemas.map(a => a.data.map(e => e.applicationVersion).filter(Boolean)).flat().pop();
    let v = "release";
    if (thunderbird_version.includes("esr")) v = "esr";
    if (thunderbird_version.includes("b")) v = "beta";
    const long_title = `WebExtension API Documentation for Thunderbird ${thunderbird_version}`;
    const title = `WebExtension API Documentation & Guides (Thunderbird ${TITLE_DATA[v].prefix}${thunderbird_version.split(".")[0]}, Manifext V${config.manifest_version})`;
    const link = `https://webextension-api.thunderbird.net/en/${TITLE_DATA[v].slug}mv${config.manifest_version}/`

    // Read fluent strings for permissions.
    let PERMISSION_LOCALES = await fs.readFile(path.join(config.schemas, `permissions.ftl`), "utf8");

    // Parent and Child implementations are in separate files and need to be
    // merged. Sub namespaces are in the same file and need to be separated.
    // Filter out global type definitions.
    const namespaces = new Map();
    const globalTypes = new Map();
    const relatedNamespaceNames = new Map();
    for (let schema of schemas) {
        if (ADDITIONAL_TYPE_FILES.includes(schema.file)) {
            let data = schema.data.find(e => e.types);
            ADDITIONAL_TYPE_PREFIXES.push(data.namespace);
            data.types.forEach(t => {
                globalTypes.set(`${data.namespace}.${t.id}`, t)
            });
            continue;
        }

        const manifestNamespace = schema.data.find(e => e.namespace == "manifest");
        const otherNamespaces = schema.data.filter(e => e.namespace != "manifest");
        for (let entry of otherNamespaces) {
            const name = entry.namespace;
            const namespace = tools.mergeSchema(namespaces.get(name) ?? [], entry, manifestNamespace);
            namespaces.set(name, namespace);
        }

        const names = relatedNamespaceNames.get(schema.file) || [];
        names.push(...otherNamespaces.map(e => e.namespace));
        relatedNamespaceNames.set(schema.file, names);
    }

    await tools.copyFolder(TEMPLATE_PATH, config.output);

    const apiNames = [...namespaces.keys()]
    await tools.replacePlaceholdersInFile(
        path.join(config.output, "index.rst"),
        {
            "{{TITLE}}": [
                "=".repeat(title.length),
                title,
                "=".repeat(title.length),
            ],
            "{{VERSION_NOTE}}": [],
            "{{API_LIST}}": apiNames.sort(),
        }
    );
    await tools.replacePlaceholdersInFile(
        path.join(config.output, "conf.py"),
        {
            "{{TITLE}}":
                [`${long_title}<br><br>Manifest V${config.manifest_version}`],
        }
    );
    await tools.replacePlaceholdersInFile(
        path.join(config.output, "README.md"),
        {
            "{{TITLE}}": [
                title,
            ],
            "{{LINK}}": [
                link,
            ],
        }
    );

    // First loop over manifest schemas to extract extends and update the global
    // manifest schema.
    for (let [namespaceName, schema] of namespaces) {
        const manifestSchema = schema.find(e => e.namespace == "manifest");
        for (let localDefinition of (manifestSchema.types || [])) {
            let extend = localDefinition["$extend"];
            // We only care about extends here. There *are* manifests which also
            // add local types to the global manifest (Theme), but we use the local
            // manifest for the individual API generations.
            if (extend) {
                let globalDefinition = globalTypes.get(`manifest.${extend}`);
                globalDefinition = tools.mergeSchemaExtensions(globalDefinition, localDefinition);
                globalTypes.set(`manifest.${extend}`, globalDefinition);
            }
        }
    }

    for (let [namespaceName, schema] of namespaces) {
        const manifestSchema = schema.find(e => e.namespace == "manifest");
        const namespaceSchema = schema.find(e => e.namespace == namespaceName);

        const writer = new Writer({
            config,
            namespaces,
            namespaceName,
            namespaceSchema,
            manifestSchema,
            globalTypes,
            PERMISSION_LOCALES,
            ADDITIONAL_TYPE_PREFIXES,
            RELATED_NAMESPACE_NAMES: [...relatedNamespaceNames.values()].find(e => e.includes(namespaceName)),
        })
        const doc = await writer.generateApiDoc();

        await fs.writeFile(
            path.join(config.output, `${namespaceName}.rst`),
            doc.toString(),
            "utf8"
        );
    }

    await fs.writeFile(
        path.join(`_all.json`),
        JSON.stringify(schemas, null, 2),
        "utf8"
    );
}