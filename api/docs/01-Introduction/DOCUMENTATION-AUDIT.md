# Documentation audit

Purpose

This page summarizes the documentation situation in the repository and explains the cleanup approach.

Who should read this

This document is intended for maintainers, product owners, and technical writers who need to understand why the documentation set was reorganized.

Overview

The repository contained many useful engineering notes, but several of them were written as temporary implementation records rather than as product documentation. This created duplication, inconsistent terminology, and mixed audiences.

## Audit findings

### Keep

These documents were retained because they still serve an active purpose:

- [docs/README.md](../README.md)
- [docs/setup/DEVELOPMENT_SETUP.md](../setup/DEVELOPMENT_SETUP.md)
- [docs/setup/ENVIRONMENT_SETUP.md](../setup/ENVIRONMENT_SETUP.md)
- [docs/api/README.md](../api/README.md)
- [docs/ERP_DOCUMENTATION.md](../ERP_DOCUMENTATION.md)

### Update

These documents were rewritten into the new structure because they were useful but difficult to navigate:

- The root documentation landing page
- The development and environment setup guidance
- The architecture overview pages
- The API and troubleshooting entry points

### Merge

The old repository content was consolidated into the new numbered documentation set so that setup, architecture, and troubleshooting would each live in one logical place.

### Archive

Implementation history, detailed fix reports, and debugging notes were moved out of the active product path and grouped into the archive area.

## Duplicate and outdated content patterns

The main problems were:

- repeated setup instructions in multiple files
- implementation notes mixed with user-facing guidance
- architecture pages that described the same system from different angles
- long debugging reports that should not appear in the main product documentation

## Action taken

The documentation now follows a single structure:

- introduction
- getting started
- architecture
- modules
- administration
- development
- deployment
- testing
- troubleshooting
- changelog
- archive

## Related documents

- [Documentation architecture](./DOCUMENTATION-ARCHITECTURE.md)
- [Getting started](../02-Getting-Started/README.md)
- [Archive](../Archive/README.md)

## Previous page

- [Introduction](./README.md)

## Next page

- [Documentation architecture](./DOCUMENTATION-ARCHITECTURE.md)
