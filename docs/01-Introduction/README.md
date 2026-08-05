# Introduction

Purpose

This section explains what the Enterprise ERP product is, who it is for, and how the documentation is organized.

Who should read this

This page is intended for business stakeholders, project sponsors, administrators, and developers who need a high-level understanding before diving into setup or implementation details.

Overview

The product is a modular enterprise application that brings core business workflows into one platform. It combines business operations, HR, sales, finance, notifications, projects, and reporting so teams can work from a shared system instead of separate tools.

The platform uses three primary layers:

- Frontend: Next.js interface for user workflows and dashboards
- Backend: NestJS API for business logic, validation, and security
- Database: Prisma-backed relational database for persistent system records

## Product scope

The current product includes modules for:

- People and HR workflows
- CRM and sales pipeline management
- Finance and accounting workflows
- Projects and task coordination
- Notifications and approvals
- Reporting and analytics

## Documentation model

The active documentation set follows a simple model:

- Start with the overview
- Move to setup and local run instructions
- Read architecture and modules to understand the system
- Use administration, development, testing, and troubleshooting for operational support

## Common terms

- ERP: enterprise resource planning, the shared system used to manage business operations
- CRM: customer relationship management, used for sales and customer interaction tracking
- API: the backend service layer that receives requests and returns data
- Module: a functional area such as HR, finance, CRM, or projects
- Role: a user access type such as administrator, manager, or employee

## Related documents

- [Documentation audit](./DOCUMENTATION-AUDIT.md)
- [Documentation architecture](./DOCUMENTATION-ARCHITECTURE.md)
- [Getting started](../02-Getting-Started/README.md)

## Previous page

- [Documentation home](../README.md)

## Next page

- [Documentation architecture](./DOCUMENTATION-ARCHITECTURE.md)
