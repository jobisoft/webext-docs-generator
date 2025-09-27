/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Author: John Bieling
 */

/** TODO:
 * Diff between MailExtension APIs and WebExtension APIs
 */

import {
    copyFolder,
    getSchemaFiles,
    mergeSchema,
    parseArgs,
    replacePlaceholdersInFile,
} from './modules/tools.mjs';

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
`;

const config = parseArgs();
if (!config.schemas || !config.output || !config.manifest_version) {
    console.log(HELP_SCREEN);
} else {
    // Clone template folder and adjust cloned files.
    const schemas = await getSchemaFiles(config.schemas);
    const thunderbird_version = schemas.map(a => a.data.map(e => e.applicationVersion).filter(Boolean)).flat().pop();
    const title = `WebExtension Documentation for Thunderbird ${thunderbird_version}`;

    // Read fluent strings for permissions.
    let permissionLocales = await fs.readFile(path.join(config.schemas, `permissions.ftl`), "utf8");

    // Parent and Child implementations are in separate files and need to be
    // merged. Sub namespaces are in the same file and need to be separated.
    // Filter out global type definitions.
    const namespaces = new Map();
    const globalTypes = new Map();
    for (let schema of schemas) {
        if (["extension_types.json", "manifest.json", "types.json"].includes(schema.file)) {
            let data = schema.data.find(e => e.types);
            data.types.forEach(t => {
                globalTypes.set(`${data.namespace}.${t.id}`, t)
            });
            continue;
        }
        if (["experiments.json", "events.json"].includes(schema.file)) {
            continue;
        }
        const manifest = schema.data.find(e => e.namespace == "manifest")
        for (let entry of schema.data.filter(e => e.namespace != "manifest")) {
            const name = entry.namespace;
            const namespace = mergeSchema(namespaces.get(name) ?? [], entry, manifest);
            namespaces.set(name, namespace);
        }
    }
    const allNamespaces = [...namespaces.keys()];
    const ownerNamespaces = Array.from(namespaces)
        .map(([key, value]) => ({
            name: key,
            mozilla: value.some(e => e.annotations?.some(a => a.mdn_documentation_url))
        }));

    await copyFolder(TEMPLATE_PATH, config.output);
    await replacePlaceholdersInFile(
        path.join(config.output, "index.rst"),
        {
            "{{TITLE}}": [
                "=".repeat(title.length),
                title,
                "=".repeat(title.length),
            ],
            "{{VERSION_NOTE}}": [],
            "{{THUNDERBIRD_API_LIST}}": ownerNamespaces.filter(e => e.mozilla == false).map(e => e.name).sort(),
            "{{MOZILLA_API_LIST}}": ownerNamespaces.filter(e => e.mozilla == true).map(e => e.name).sort(),
        }
    );
    await replacePlaceholdersInFile(
        path.join(config.output, "conf.py"),
        {
            "{{TITLE}}":
                [`${title}<br><br>Manifest V${config.manifest_version}`],
        }
    );

    for (let [namespace, schema] of namespaces) {
        const apiSchema = schema.find(e => e.namespace == namespace);
        const manifestSchema = schema.find(e => e.namespace == "manifest");

        const writer = new Writer({
            config,
            namespace,
            apiSchema,
            manifestSchema,
            globalTypes,
            allNamespaces,
            permissionLocales,
        })
        const doc = await writer.generateApiDoc();

        await fs.writeFile(
            path.join(config.output, `${namespace}.rst`),
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