# 📚 WebExtension API Documentation Generator

Script to generate Thunderbird WebExtension API documentation in reStructuredText (RST) format from annotated schema files. The generated files are intended to be used with [Sphinx](https://www.sphinx-doc.org/) / [ReadTheDocs](https://about.readthedocs.com/) to build the final HTML developer documentation.

## ✨ Features

- Parses [annotated WebExtension schema files](https://github.com/thunderbird/webext-annotated-schemas).
- Generates `.rst` files for each API namespace, with linkable sections for every `type`, `function`, `event` and `property`.
- Generates a ready-to-use Sphinx index, controlled through a template mechanism.

## 📋 Requirements

- [Node.js](https://nodejs.org/) (v18+ recommended).
- A set of Thunderbird WebExtension API schemas (e.g. from [`thunderbird/webext-annotated-schemas`](https://github.com/thunderbird/webext-annotated-schemas)).
- A template directory containing:
  - `index.rst`
  - `conf.py`
  - other supporting files needed by [Sphinx](https://www.sphinx-doc.org/) / [ReadTheDocs](https://about.readthedocs.com/) to generate the html documents

## 📝 Template support

The files in the template folder are copied verbatim into the root folder of the generated output, but support a `{{CONDITION}}` tag. It allows to include or exclude portions of text in template files based on runtime conditions, such as manifest version or product version.

### Syntax

```rst
{{CONDITION:<condition_string>:<text_to_include>}}
```

- `<condition_string>`: A comma-separated list of conditions to evaluate.
- `<text_to_include>`: The text that will be included in the output if all conditions pass. If the conditions fail, this text is omitted. The text can span across multiple lines.

### Supported Conditions

- `MV=<version>`: Match the manifest version.  
- `VERSION=<version>`: Match the product version.  

Multiple values can be provided with `|` for OR logic. Multiple conditions separated by commas are evaluated with AND logic.

### Examples

```rst
{{CONDITION:MV=3:* :doc:`/guides/manifestV3`}}
```
- Include the text `* :doc:`/guides/manifestV3`` only if `MV=3`.  

```rst
{{CONDITION:MV=3,VERSION=ESR|RELEASE:Special multi line instructions for ESR
or RELEASE...}}
```
- Include text if `MV=3` **AND** `VERSION` is either `ESR` or `RELEASE` (and not `BETA`).

## 📦 Installation

```bash
npm install
```

## 🖥️ Usage

```bash
node generate-docs.js --schemas=path/to/schemas --output=path/to/output --manifest_version=3 [--report_errors]
```

### Options

| Option                 | Description                                                                |
|------------------------|----------------------------------------------------------------------------|
| `--schemas=path`       | Path to the folder containing schema files (`.json`) and `permissions.ftl` | 
| `--output=path`        | Path of the folder where generated markdown files will be written.<br> *Note: This folder will be deleted before generation.* |
| `--manifest_version`   | Target manifest version (e.g. `2`, or `3 `).                               | 
| `--report_errors`      | (Optional) Report errors in the schema files.                              |

## ⚖️ License

This project is licensed under the [Mozilla Public License, v. 2.0](https://mozilla.org/MP/2.0/).
