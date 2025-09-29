import { AdvancedArray, LevelState } from "./classes.mjs";
import { fixMalformedClosingTags } from "./tools.mjs"
import * as strings from "./strings.mjs";

const DBT = "``";
const SBT = "`";

export class Writer {
    #options;

    constructor(options) {
        this.#options = options;
        this.sidebar = new Map();
        this.foundPermissions = new Set();
        this.foundTypes = new Set();
        this.version_added_tracker = new LevelState()
    }

    get namespace() {
        return this.#options.namespace;
    }
    get apiSchema() {
        return this.#options.apiSchema;
    }
    get manifestSchema() {
        return this.#options.manifestSchema;
    }
    get config() {
        return this.#options.config;
    }
    get globalTypes() {
        return this.#options.globalTypes;
    }
    get allNamespaces() {
        return this.#options.allNamespaces;
    }
    get permissionLocales() {
        return this.#options.permissionLocales;
    }

    api_member({ name = null, type = null, annotation = null, description = [] } = {}) {
        const lines = [
            "",
            ".. api-member::",
        ];

        if (name) {
            lines.push("   :name: " + name);
        }
        if (type) {
            lines.push("   :type: " + type);
        }
        if (annotation) {
            lines.push("   :annotation: " + annotation);
        }
        if (description && description.length > 0) {
            lines.push("");
            for (const line of description) {
                lines.push("   " + line);
            }
        }

        return lines;
    }

    api_header(label, content = [], annotation = null) {
        const lines = [
            "",
            ".. api-header::",
            `   :label: ${label}`
        ];

        if (annotation) {
            lines.push(`   :annotation: ${annotation}`);
        }

        lines.push("");

        if (content.length > 0) {
            for (const line of content) {
                lines.push("   " + line);
            }
            lines.push("");
        }

        return lines;
    }

    header_1(string) {
        return [
            "",
            "=".repeat(string.length),
            string,
            "=".repeat(string.length),
            "",
        ];
    }

    header_2(title, classnames = "api-main-section") {
        return [
            "",
            `.. rst-class:: ${classnames}`,
            "",
            title,
            "=".repeat(title.length),
            "",
        ];
    }

    header_3(text, { label = null, info = "" } = {}) {
        // The api-section-annotation-hack directive attaches the annotation
        // to the preceding section header, closes standard section div and opens api-section-body div
        return [
            ...this.reference(label),
            text,
            "-".repeat(text.length),
            "",
            `.. api-section-annotation-hack:: ${info}`,
            ""
        ];
    }

    format_params(func, { callback = null } = {}) {
        const params = [];

        for (const param of func.parameters ?? []) {
            if (param.name === callback) {
                continue;
            }
            if (param.optional) {
                params.push(`[${param.name}]`);
            } else {
                params.push(param.name);
            }
        }

        return params.join(", ");
    }

    format_addition(obj, depth) {
        const { version_added } = obj?.annotations?.find(a => "version_added" in a) ?? {};
        if (version_added && this.version_added_tracker.isDifferentFromParent(depth, version_added)) {
            return `-- [Added in TB ${version_added}]`;
        }
        return "";
    }

    format_object(name, obj, { print_description_only = false, print_enum_only = false, enumChanges = null } = {}) {
        // If we have received an enumChanges object and the obj does not already have one
        if (!obj.enumChanges && enumChanges !== null) {
            obj.enumChanges = enumChanges;
        }

        const parts = this.get_api_member_parts(name, obj);

        // enum_only: fake header + enum
        // description_only: fake header + description + enum + nested
        // default: standard header + description + enum + nested

        const fakeHeader = [];
        const content = [];
        const lines = [];

        let indent;
        if (print_enum_only || print_description_only) {
            // fake api-member div structure, so style sheets continue to work
            indent = "      ";
            fakeHeader.push(
                "",
                ".. container:: api-member-node",
                "",
                "   .. container:: api-member-description-only"
            );
        } else {
            indent = "   ";
            content.push(...this.api_member({ name: parts.name, type: parts.type, annotation: parts.annotation }));
        }

        let nested_content = [];
        if (obj.type === "object" && obj.properties) {
            const entries = Object.entries(obj.properties).sort(([a], [b]) => a.localeCompare(b));

            // Required properties first
            for (const [key, value] of entries) {
                if (value.ignore) continue;
                if (!value.optional) {
                    nested_content.push(...this.format_object(key, value));
                }
            }

            // Optional properties next
            for (const [key, value] of entries) {
                if (value.ignore) continue;
                if (value.optional) {
                    nested_content.push(...this.format_object(key, value));
                }
            }
        }

        if (print_enum_only) {
            content.push(...parts.enum.map(sub => `${indent}${sub}`));
        } else {
            content.push(...parts.description.map(sub => `${indent}${sub}`));
            content.push(...parts.enum.map(sub => `${indent}${sub}`));
            content.push(...nested_content.map(sub => `${indent}${sub}`));
        }

        if (content.length > 0) {
            lines.push(...fakeHeader);
            lines.push(...content);
            lines.push("");
        }

        return lines;
    }

    async format_manifest_permissions() {
        const section = new AdvancedArray();

        const entries = {
            manifest: {
                single: "A manifest entry named %s is required to use ``messenger.%s.*``.",
                multiple: "One of the manifest entries %s or %s is required to use ``messenger.%s.*``.",
                entries: [],
            },
            permissions: {
                single: "The permission %s is required to use ``messenger.%s.*``.",
                multiple: "One of the permissions %s or %s is required to use ``messenger.%s.*``.",
                entries: [],
            },
        };

        // Read globally required permissions first.
        if (this.apiSchema?.permissions) {
            const permissions = Array.from(new Set(this.apiSchema.permissions)).sort();
            for (const permission of permissions) {
                if (!permission.startsWith("manifest:")) {
                    this.foundPermissions.add(permission);
                    entries.permissions.entries.push(`:permission:${SBT}${permission}${SBT}`);
                } else {
                    entries.manifest.entries.push(`:value:${SBT}${permission.slice(9)}${SBT}`);
                }
            }
        }

        for (const entrytype of ["manifest", "permissions"]) {
            const entry = entries[entrytype];
            let text = "";
            if (entry.entries.length === 0) continue;
            else if (entry.entries.length === 1) {
                text = entry.single.replace("%s", entry.entries[0]).replace("%s", this.namespace);
            } else {
                const last = entry.entries.pop();
                text = entry.multiple
                    .replace("%s", entry.entries.join(", "))
                    .replace("%s", last)
                    .replace("%s", this.namespace);
            }

            section.append([
                "",
                ".. rst-class:: api-permission-info",
                "",
                ".. note::",
                "",
                "   " + text,
                ""
            ]);
        }

        return section;
    }

    format_required_permissions(obj) {
        // Merge globally required permissions and object-specific permissions
        const allPermissions = [
            ...(this.apiSchema?.permissions || []),
            ...(obj?.permissions || []),
        ];
        // Keep track of found permissions.
        allPermissions
            .filter(permission => !permission.startsWith("manifest:"))
            .forEach(permission => this.foundPermissions.add(permission));

        const entries = [];
        for (const permission of Array.from(new Set(allPermissions)).sort()) {
            if (!permission.startsWith("manifest:")) {
                this.foundPermissions.add(permission);
                entries.push(`- :permission:${SBT}${permission}${SBT}`);
            }
        }

        const permissions = new AdvancedArray();
        if (entries.length > 0) {
            permissions.append(this.api_header("Required permissions", entries));
        }
        return permissions;
    }

    format_enum(name, value) {
        if (value.enum == null) {
            if (value.items != null) {
                return this.format_enum(name, value.items);
            }
            return [];
        }

        const enum_lines = [""];
        enum_lines.push("Supported values:");

        const schema_annotations = value.enums ?? null;

        for (const enum_value of value.enum) {
            let enum_annotation = null;
            let enum_description = null;

            if (schema_annotations?.[enum_value]) {
                enum_annotation = this.format_addition(schema_annotations[enum_value], 3);
                enum_description = this.format_description(schema_annotations[enum_value]);
            }

            enum_lines.push(...this.api_member({
                name: `:value:${SBT}${enum_value}${SBT}`,
                annotation: enum_annotation,
                description: enum_description
            }));
        }

        return enum_lines;
    }

    format_type(typeDef) {
        const section = new AdvancedArray();
        section.append(this.header_3(
            typeDef.id,
            {
                label: `${this.namespace}.${typeDef.id}`,
                info: this.format_addition(typeDef, 1)
            }
        ));

        section.append(this.format_description(typeDef));

        if ("type" in typeDef) {
            if (
                typeDef.type === "object" &&
                !("isInstanceOf" in typeDef) &&
                ("properties" in typeDef || "functions" in typeDef)
            ) {
                let content = new AdvancedArray();

                if ("properties" in typeDef) {
                    const items = Object.entries(typeDef.properties).sort(([a], [b]) =>
                        a.localeCompare(b)
                    );

                    for (const [key, value] of items) {
                        if (!value.optional) {
                            content.append(this.reference(`${this.namespace}.${typeDef.id}.${key}`));
                            content.append(this.format_object(key, value));
                        }
                    }

                    for (const [key, value] of items) {
                        if (value.optional) {
                            content.append(this.reference(`${this.namespace}.${typeDef.id}.${key}`));
                            content.append(this.format_object(key, value));
                        }
                    }
                }

                section.append(this.api_header("object", content));
            } else {
                section.append(this.api_header(
                    this.get_type(typeDef, typeDef.id),
                    this.format_object(null, typeDef, { print_enum_only: true })
                ));
            }
        } else if ("choices" in typeDef) {
            let first = true;
            for (const choice of typeDef.choices) {
                if (!first) {
                    section.push("", "OR", "");
                }
                first = false;
                section.append(this.api_header(
                    this.get_type(choice, typeDef.id),
                    this.format_object(null, choice, {
                        print_description_only: true,
                        enumChanges: typeDef.enumChanges,
                    }))
                );
            }
        }

        section.append("");
        return section;
    }

    format_description(obj) {
        const section = new AdvancedArray();
        if ("description" in obj) {
            // Descriptions may still contain <li> tags, which are transformed
            // into markdown bullet points and line breaks. Eventually, those
            // should be replaced by annotations.
            const desc = this.replace_code(obj.description.trim()).split("\n");
            if (desc.length > 1) {
                console.log(`Found description with <li> tags (converted to line breaks) in ${this.namespace} API`, desc)
            }
            section.append("");
            section.append(desc);
            section.append("");
        }
        for (let annotation of obj.annotations ?? []) {
            if (Object.hasOwn(annotation, "text")) {
                section.append("");
                section.append(this.replace_code(annotation.text));
                section.append("");
            }
            if (Object.hasOwn(annotation, "code")) {
                section.append([
                    "",
                    `.. code-block:: ${annotation.type ?? ""}`,
                    "",
                    ...annotation.code.map(e => `   ${e}`),
                    "",
                ])
            }
            if (Object.hasOwn(annotation, "list")) {
                section.append("");
                section.append(annotation.list.map(e => ` * ${this.replace_code(e)}`))
                section.append("");
            }
            for (let box of ["note", "hint", "warning"]) {
                if (Object.hasOwn(annotation, box)) {
                    section.append([
                        "",
                        `.. ${box}::`,
                        "",
                        `   ${this.replace_code(annotation[box])}`,
                        "",
                    ])
                }
            }
        }

        return section;
    }

    replace_code(str) {
        // Fix malformed <val> and <var> tags where closing tag is missing
        str = fixMalformedClosingTags(str, ["val", "var", "code", "permission"]);

        // Remove <code> inside <a>, as it is not render-able.
        str = str.replace(
            /(<a .*?>)<code>(.*?)<\/code>(.*?<\/a>)/g,
            '$1$2$3'
        );

        const replacements = {
            "<em>": "*",
            "</em>": "*",
            "<b>": "**",
            "</b>": "**",
            "<code>": ":code:`",
            "</code>": "`",
            // Work around sphinx bug ignoring roles if they start with spaces,
            // by prefixing a zero-width space.
            "<var> ": ":value:`\u200B ",
            "<val> ": ":value:`\u200B ",
            "<var>": ":value:`",
            "<val>": ":value:`",
            "</var>": "`",
            "</val>": "`",
            "&mdash;": "—",
            // Some tags just have to go.
            "<p>": "",
            "</p>": "",
            "<ul>": "",
            "</ul>": "",
            "<ol>": "",
            "</ol>": "",
            "</li>": "",
            // The input data is read from JSON, which has special escape rules.
            // A literal \n in the JSON will be interpreted as a line break.
            // Per convention, we interpret these as their literal values.
            "\b": "\\b",
            "\f": "\\f",
            "\r": "\\r",
            "\t": "\\t",
            "\n": "\\n",
            "\\": "\\\\",
            // Some descriptions may use <li> tags, replace by bullet points and
            // actual line breaks.
            "<li>": "\n\n * "
        };

        for (const [s, r] of Object.entries(replacements)) {
            str = str.split(s).join(r);
        }

        // Fix refs with stray () at the end.
        str = str.replace(/\$\((ref:[^)]*?)\(\)\)/g, (match, p1) => {
            console.warn('Found stray empty parentheses in ref:', match);
            return `$(${p1})`;
        });
        // Regex replacements
        str = str.replace(/\$\((ref:(.*?))\)/g, ":ref:`$2`");
        str = str.replace(/\$\((doc:(.*?))\)/g, ":doc:`$2`");
        // Replace deprecated $(topic:...) references with their plain link text.
        str = str.replace(/\$\((topic:[^\)]+)\)\[(.*?)\]/g, "$2");
        // Replace URLs.
        str = str.replace(/<a href="(.*?)">(.*?)<\/a>/g, "`$2 <$1>`__");
        str = str.replace(/<a href='(.*?)'>(.*?)<\/a>/g, "`$2 <$1>`__");
        // Replace and track permissions.
        str = str.replace(/<permission>(.*?)<\/permission>/g, (match, permission) => {
            this.foundPermissions.add(permission);
            return `:permission:${SBT}${permission}${SBT}`;
        });

        return str;
    }

    reference(label) {
        if (label === null || label === undefined) {
            return [];
        }

        return [
            `.. _${label}:`,
            ""
        ];
    }

    format_link(ref) {
        if (ref === "extensionTypes.File") {
            return "`File <https://developer.mozilla.org/en-US/docs/Web/API/File>`__";
        }
        if (ref === "extensionTypes.Date") {
            return "`Date <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date>`__";
        }
        if (ref === "runtime.Port") {
            return "`Port <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port>`__";
        }

        // Links to the same page do not need to provide a namespace.
        if (ref.startsWith(`${this.namespace}.`)) {
            ref = ref.slice(this.namespace.length + 1)
        }
        this.foundTypes.add(ref);

        // Global types will be handled per API, locally.
        for (let prefix of ["manifest.", "extensionTypes."]) {
            if (ref.startsWith(prefix)) {
                ref = ref.slice(prefix.length);
                break;
            }
        }
        // Make sure the namespace is prefixed for local links.
        if (!ref.includes(".")) {
            ref = `${this.namespace}.${ref}`;
        }


        return `:ref:${SBT}${ref}${SBT}`;
    }

    get_api_member_parts(name, value) {
        const parts = {
            name: "",
            type: "",
            annotation: "",
            description: new AdvancedArray(),
            enum: new AdvancedArray(),
        };

        // The return element is using a fake "_returns" name
        let type_string = "%s";
        if (name === "_returns") {
            if (value.optional) {
                // type_string = "[%s]" activate not yet
                type_string = "%s";
            }
        } else if (name) {
            type_string = "(%s)";
            if (value.optional) {
                parts.name = `[${DBT}${name}${DBT}]`;
                type_string = "(%s, optional)";
            } else {
                parts.name = `${DBT}${name}${DBT}`;
            }
        }

        if ("unsupported" in value) {
            type_string += " **Unsupported.**";
        } else if ("deprecated" in value) {
            type_string += " **Deprecated.**";
        }

        if ("type" in value || "$ref" in value) {
            parts.type = type_string.replace("%s", this.get_type(value, name));
        } else if ("choices" in value) {
            const choices = value.choices.map(choice => this.get_type(choice, name));
            parts.type = type_string.replace("%s", choices.join(" or "));
        }

        parts.description.append(this.format_description(value));
        parts.annotation = this.format_addition(value, 2);
        parts.enum.append(this.format_enum(name, value));

        return parts;
    }

    get_type(obj, name) {
        if ("type" in obj) {
            if (obj.enum != null) {
                return `${SBT}${obj.type}${SBT}`;
            } else if (obj.type === "array") {
                if ("items" in obj) {
                    if ("choices" in obj.items) {
                        const choices = obj.items.choices.map(choice => this.get_type(choice, name));
                        return `array of ${choices.join(" or ")}`;
                    } else {
                        return `array of ${this.get_type(obj.items, name)}`;
                    }
                } else {
                    return "array";
                }
            } else if ("isInstanceOf" in obj) {
                return `${SBT}${obj.isInstanceOf} <https://developer.mozilla.org/en-US/docs/Web/API/${obj.isInstanceOf}>${SBT}__`;
            } else {
                return obj.type;
            }
        } else if ("$ref" in obj) {
            return this.format_link(obj["$ref"]);
        }
    }

    async generateManifestSection() {
        let section = new AdvancedArray();
        if (this.manifestSchema.types) {
            for (let type of this.manifestSchema.types) {
                if (type.$extend === "WebExtensionManifest") {
                    // Sort by property name, unless "sort" key overrides
                    let items = Object.entries(type.properties).sort(([aKey, aVal], [bKey, bVal]) => {
                        let aSort = "sort" in aVal ? aVal.sort : aKey;
                        let bSort = "sort" in bVal ? bVal.sort : bKey;
                        return aSort < bSort ? -1 : aSort > bSort ? 1 : 0;
                    });
                    for (let [name, value] of items) {
                        section.append(this.format_object(name, value));
                    }
                }
            }
        }

        if (section.length > 0) {
            section.prepend(this.header_2("Manifest file properties"));
            this.sidebar.set("manifest", "  * `Manifest file properties`_");
        }

        return section;
    }

    async generatePermissionsSection() {
        let permissionStrings = {};
        for (let line of this.permissionLocales.split("\n")) {
            if (line.startsWith("webext-perms-description")) {
                let parts = line.split("=", 2);
                let permissionName = parts[0]
                    .slice(25)
                    .replace(/-/g, ".")
                    .trim();
                // Remove any numbers from permissionName
                permissionName = permissionName.replace(/[0-9]/g, "");
                permissionStrings[permissionName] = parts[1].trim();
            }
        }

        let manifestPermissions = new AdvancedArray();
        manifestPermissions.append(await this.format_manifest_permissions());

        // Include all permissions used somewhere in this API.
        // TODO: SensitiveDataUpload
        let usedPermissions = new AdvancedArray();

        for (const value of Array.from(this.foundPermissions).sort()) {
            let description = strings.permission_descriptions[value]
                || permissionStrings[value]
                || (this.allNamespaces.includes(value) && strings.permission_descriptions["*"].replace("$NAME$", value))
                || "";

            if (!description) {
                console.log("Missing permission description for", value)
            }

            usedPermissions.append(this.api_member({
                name: `:permission:${SBT}${value}${SBT}`,
                description: [description]
            }));
        }

        let section = new AdvancedArray();
        if (manifestPermissions.length > 0 || usedPermissions.length > 0) {
            section.append(this.header_2("Permissions"));
            if (usedPermissions.length > 0) {
                section.addParagraph(strings.permission_header)
                section.append(usedPermissions);
                section.addParagraph(strings.permission_warning)
            }
            section.append(manifestPermissions);
            this.sidebar.set("permissions", "  * `Permissions`_");
        }

        return section;
    }

    async generateFunctionsSection() {
        if (!Array.isArray(this.apiSchema.functions) || this.apiSchema.functions.length == 0) {
            return null;
        }

        const section = new AdvancedArray();
        for (let obj of this.apiSchema.functions.sort((a, b) => a.name.localeCompare(b.name))) {
            // Skip if this function is not supported
            const { version_added } = obj?.annotations?.find(a => "version_added" in a) ?? {};
            if (version_added === false) {
                continue;
            }

            section.append(this.header_3(
                `${obj.name}(${this.format_params(obj, { callback: obj.async })})`,
                {
                    label: `${this.namespace}.${obj.name}`,
                    info: this.format_addition(obj, 1)
                }
            ));

            section.append(this.format_description(obj));

            if (Array.isArray(obj.parameters) && obj.parameters.length > 0) {
                let content = new AdvancedArray();
                for (const param of obj.parameters) {
                    if (obj.async === param.name) {
                        // used for callback type
                        if (param.parameters && param.parameters.length > 0) {
                            obj.returns = param.parameters[0];
                        }
                    } else {
                        content.append(this.format_object(param.name, param));
                    }
                }
                if (content.length > 0) {
                    section.append(this.api_header("Parameters", content));
                }
            }

            if ("returns" in obj) {
                const content = new AdvancedArray();
                content.append(this.format_object("_returns", obj.returns));
                content.append([
                    "",
                    ".. _Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise"
                ]);
                section.append(this.api_header("Return type (`Promise`_)", content));
            }

            section.append(this.format_required_permissions(obj));

            //if ("hints" in func) {
            //    lines.push(...format_hints(func));
            //}

        }

        // Early exit if no functions have been found.
        if (section.length == 0) {
            return null;
        }

        this.sidebar.set("functions", "  * `Functions`_");

        section.prepend(this.header_2("Functions"));
        return section;
    }

    async generateEventsSection() {
        if (!Array.isArray(this.apiSchema.events) || this.apiSchema.events.length == 0) {
            return null;
        }

        const section = new AdvancedArray();
        for (let event of this.apiSchema.events.sort((a, b) => a.name.localeCompare(b.name))) {
            const { version_added } = event?.annotations?.find(a => "version_added" in a) ?? {};
            if (version_added === false) {
                continue;
            }

            section.append(this.header_3(
                `${event.name}`, // could also add params later: `${event.name}(${format_params(event)})`
                {
                    label: `${this.namespace}.${event.name}`,
                    info: this.format_addition(event, 1)
                }
            ));

            section.append(this.format_description(event));

            const listener = {
                name: `listener(${event.parameters?.map(p => p.name).join(", ") || ""})`,
                description: "A function that will be called when this event occurs.",
            };

            let content = new AdvancedArray();
            for (const param of [listener, ...(event.extraParameters || [])]) {
                content.append(this.format_object(param.name, param));
            }

            const extraParams = (event.extraParameters || []).map(p => p.name);
            section.append(this.api_header(
                `Parameters for ${event.name}.addListener(${["listener", ...extraParams].join(", ")})`,
                content
            ));

            if ("parameters" in event && event.parameters.length) {
                content = new AdvancedArray();
                for (const param of event.parameters) {
                    content.append(this.format_object(param.name, param));
                }
                section.append(
                    this.api_header("Parameters passed to the listener function", content)
                );
            }

            if ("returns" in event) {
                section.append(this.api_header(
                    "Expected return value of the listener function",
                    this.format_object("", event.returns)
                ));
            }

            section.append(this.format_required_permissions(event));
        }

        // Early exit if no events have been found.
        if (section.length == 0) {
            return null;
        }
        this.sidebar.set("events", "  * `Events`_");

        section.prepend(this.header_2("Events"));
        return section;
    }

    async generateTypesSection() {
        if (!this.foundTypes.size) {
            return null;
        }

        const prefix_namespace = (id) => {
            if (id.startsWith(`${this.namespace}.`)) {
                return id;
            }
            return `${this.namespace}.${id}`
        }
        const prefix_manifest = (id) => {
            if (id.startsWith("`manifest.")) {
                return id;
            }
            return `manifest.${id}`
        }
        // We use a writer for each type definition, so we can add types as we go
        // and sort them at the end. We loop over foundTypes until it does not change
        // anymore (to find nested types).

        // The collected types could be without namespace, which could either be
        // manifest.* or namespace.*
        const definitions = new Map();
        let done = false;

        do {
            let prevFoundSize = this.foundTypes.size;
            for (const id of [...this.foundTypes].filter(id => !definitions.has(id))) {

                const typeDef =
                    this.globalTypes.get(id) ||
                    this.globalTypes.get(`manifest.${id}`) ||
                    (this.apiSchema.types && this.apiSchema.types.find(e => e.id && prefix_namespace(e.id) == prefix_namespace(id))) ||
                    (this.manifestSchema.types && this.manifestSchema.types.find(e => e.id && prefix_manifest(e.id) == prefix_manifest(id)));

                if (typeDef) {
                    definitions.set(id, this.format_type(typeDef));
                } else if (done && !id.includes(".")) {
                    // We are done, but this is missing, log it.
                    console.log("Missing Type", this.namespace, id)
                };
            }

            if (done) {
                break;
            }
            if (prevFoundSize == this.foundTypes.size) {
                done = true;
            }
        } while (true)

        const section = new AdvancedArray();
        [...definitions.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([id, definition]) => section.addSection(definition));

        // Early exit if no types have been found.
        if (section.length == 0) {
            return null;
        }
        this.sidebar.set("types", "  * `Types`_");

        section.prepend(this.header_2("Types"));
        return section;
    }

    async generatePropertiesSection() {
        if (!this.apiSchema.properties) {
            return null;
        }

        const section = new AdvancedArray();
        for (let key of Object.keys(this.apiSchema.properties).sort((a, b) => a.localeCompare(b))) {
            const property = this.apiSchema.properties[key];

            const { version_added } = property?.annotations?.find(a => "version_added" in a) ?? {};
            if (version_added === false) {
                continue;
            }

            section.append(this.header_3(
                key,
                { label: `${this.namespace}.${key}` }
            ));

            if (property.description) {
                section.append(this.format_description(property));
            }

            section.append("");
        }

        // Early exit if no properties have been found.
        if (section.length == 0) {
            return null;
        }

        this.sidebar.set("properties", "  * `Properties`_");

        section.prepend(this.header_2("Properties"));
        return section;
    }

    async generateApiDoc() {
        const title = `${this.namespace} API`;
        const doc = new AdvancedArray();
        const manifest = await this.generateManifestSection();
        const functions = await this.generateFunctionsSection();
        const events = await this.generateEventsSection()
        const properties = await this.generatePropertiesSection()
        const types = await this.generateTypesSection()

        // Last, because it needs api.foundPermissions to be populated.
        const permissions = await this.generatePermissionsSection();

        doc.append([
            ".. container:: sticky-sidebar",
            "",
            `  ≡ ${title}`,
            "",
            this.sidebar.get("manifest"),
            this.sidebar.get("permissions"),
            this.sidebar.get("functions"),
            this.sidebar.get("events"),
            this.sidebar.get("types"),
            this.sidebar.get("properties"),
            "",
            "  .. include:: /_includes/developer-resources.rst",
            "",
            //        "  ≡ Related information",
            //        "",
            //        "  * :doc:`/examples/eventListeners`",
            //        "",
            "=".repeat(title.length),
            title,
            "=".repeat(title.length),
            "",
            ".. role:: permission",
            "",
            ".. role:: value",
            "",
            ".. role:: code",
            "",
        ])

        let mdn_documentation_url = this.apiSchema?.annotations?.find(e => e.mdn_documentation_url)?.mdn_documentation_url;
        if (mdn_documentation_url) {
            doc.append([
                ".. hint::",
                "",
                "   " + strings.mozilla_api
                    .replace("$NAME$", this.namespace)
                    .replace("$LINK$", `${SBT}MDN <${mdn_documentation_url}>${SBT}__`)
            ])
        }

        doc.append(this.format_description(this.apiSchema));

        doc.addSection(manifest);
        doc.addSection(permissions);
        doc.addSection(functions);
        doc.addSection(events);
        doc.addSection(types);
        doc.addSection(properties);

        return doc;
    }
}