# Course 1: Foundation - User & Provider Management

**Part of the LocalServe Marketplace Series**

## Overview

Welcome to the first course in the **LocalServe** series! In this course, you'll build the foundational user management system for a service marketplace platform. By the end, you'll have a working system where customers can register and service providers can apply to join the platform.

This course introduces you to FlowLang's core concepts while building real, production-ready workflows that will serve as the foundation for the entire LocalServe marketplace.

## What You'll Build

By the end of this course, you'll have a complete user and provider management system:

- **User Registration System**: Sign up, email verification, profile creation
- **Provider Application Workflow**: Multi-step application process with document upload
- **Admin Approval System**: Review and approve/reject provider applications
- **Profile Management**: CRUD operations for both users and providers
- **Database Schema**: PostgreSQL database for users, providers, applications
- **Test Suite**: Comprehensive tests for all workflows

## Learning Objectives

After completing this course, you will:

1. Understand FlowLang's core concepts (flows, tasks, steps, context)
2. Design and implement multi-step workflows in YAML
3. Create task implementations in Python
4. Use FlowLang's database integration helpers
5. Compose reusable subflows
6. Write tests using FlowLang's testing framework
7. Run FlowLang flows as REST APIs

## Prerequisites

### Required Knowledge
- Basic Python programming (functions, async/await, dictionaries)
- Basic understanding of REST APIs
- Familiarity with YAML syntax
- Basic SQL/database concepts

### Software Requirements
- Python 3.8 or higher
- FlowLang installed (`pip install flowlang`)
- PostgreSQL (or Docker to run PostgreSQL)
- Code editor (VS Code recommended)
- Terminal/command line access

### Before You Start
```bash
# Verify FlowLang installation
flowlang version

# Check environment
flowlang doctor

# Clone or navigate to your working directory
mkdir -p ~/localserve-course
cd ~/localserve-course
```

## Course Structure

This course consists of 6 lessons plus a hands-on project:

### [Lesson 1: Introduction to LocalServe](./lesson-01-introduction.md)
- Understanding the marketplace business model
- LocalServe architecture overview
- Two-sided marketplace concepts
- Setting up your development environment
- Your first FlowLang flow

**Duration**: 30 minutes

### [Lesson 2: User Registration Flow](./lesson-02-user-registration.md)
- Designing the registration workflow
- Input validation patterns
- Database integration (PostgreSQL)
- Email verification workflow
- Testing user registration

**Duration**: 60 minutes

### [Lesson 3: Provider Application Flow](./lesson-03-provider-application.md)
- Multi-step application process
- File upload handling
- Service category selection
- Application data validation
- Saving application data

**Duration**: 60 minutes

### [Lesson 4: Provider Approval Workflow](./lesson-04-provider-approval.md)
- Admin review workflow
- Creating reusable approval subflows
- Conditional logic (approve/reject paths)
- Email notifications
- Status tracking and updates

**Duration**: 60 minutes

### [Lesson 5: Profile Management](./lesson-05-profile-management.md)
- CRUD operations for profiles
- Update and validation flows
- Service categories and skills
- Provider availability management
- Profile search and filtering

**Duration**: 45 minutes

### [Lesson 6: Testing Your Flows](./lesson-06-testing.md)
- FlowLang testing framework
- Mocking database operations
- Testing complex workflows
- Test fixtures and data
- Running the full test suite

**Duration**: 45 minutes

### [Project: Complete Foundation System](./project/)
- Putting it all together
- Running the REST API server
- Testing via HTTP requests
- Code walkthrough
- Next steps

**Duration**: 30 minutes

## Estimated Time

**Total Course Time**: ~5 hours (including hands-on exercises)

## What's Next?

After completing Course 1, you'll continue with:

- **Course 2**: Job Posting & Discovery (coming soon)
- **Course 3**: Booking & Scheduling (coming soon)
- **Course 4**: Payment & Escrow (coming soon)

Each course builds directly on the previous one, ultimately creating a complete, production-ready marketplace platform.

## Course Philosophy

### Design-First Approach
We follow FlowLang's **design-first philosophy**:
1. **Design** the workflow in YAML (what should happen)
2. **Generate** task stubs automatically
3. **Implement** tasks incrementally
4. **Test** as you go
5. **Deploy** as REST API

This approach helps you think through the business logic before writing code.

### Incremental Learning
Each lesson introduces 1-2 new FlowLang concepts:
- Lesson 1: Flows, tasks, inputs, outputs
- Lesson 2: Database integration, validation
- Lesson 3: Multi-step workflows, file handling
- Lesson 4: Subflows, conditional logic
- Lesson 5: CRUD patterns, search
- Lesson 6: Testing framework

### Production-Ready Code
All code in this course is production-quality:
- Proper error handling
- Input validation
- Database transactions
- Comprehensive tests
- Security best practices
- Clear documentation

You can use this code as a starting point for real projects.

## Getting Help

### Resources
- [FlowLang Documentation](../../) - Complete reference
- [FlowLang Testing Guide](../../testing.md) - Testing framework
- [Database Integration Guide](../../database-integration.md) - Database helpers

### Troubleshooting
- Run `flowlang doctor` to check your environment
- Check `flowlang --help` for CLI commands
- Review error messages carefully - FlowLang provides detailed errors

### Common Issues
- **Import errors**: Make sure FlowLang is installed in your active Python environment
- **Database connection**: Verify PostgreSQL is running and connection string is correct
- **Task not found**: Ensure task is registered in `flow.py`

## Ready to Start?

Let's begin with [Lesson 1: Introduction to LocalServe](./lesson-01-introduction.md)!

---

**Course Series**: LocalServe - Service Marketplace Platform
**Course 1 of 9**: Foundation - User & Provider Management
**Next Course**: Course 2 - Job Posting & Discovery
