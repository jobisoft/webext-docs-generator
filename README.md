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
