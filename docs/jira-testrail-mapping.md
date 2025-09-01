# JIRA to TestRail Project Mapping

## Overview
Some TestRail projects contain test cases for multiple JIRA projects, especially for unified applications.

## Key Mappings

### Unified OAO (One App Only)
**TestRail Project:** Unified OAO (ID: 167)
**Related JIRA Projects:**
- **ESWCTV** (Board ID: 3859) - CTV/Connected TV features
- **ESROKU** (Board ID: not specified) - Roku platform features
- **ESW** (Board ID: 2892) - General web features
- **ESR** (Board ID: 3860) - General features

**Note:** Since Unified OAO is a single application that runs on multiple platforms (Web, CTV, Roku), the test cases are consolidated in one TestRail project but may be organized in different suites or sections based on platform or feature area.

### BET+ Related
**TestRail Projects:**
- BET+ Kids Profile (ID: 269)
- BET+ main testing may be under Paramount+ projects

### PlutoTV
**TestRail Projects:**
- PlutoTV Frontend (ID: 268)
- PlutoTV Backend (ID: 270)
- PlutoTV Data Integration (ID: 271)
- Pluto (ID: 104)

### Paramount+
**TestRail Projects:**
- ParamountPlus_GLOBAL (ID: 198)
- Paramount + / HOB INTL (ID: 138)
- ParamountPlus Content Services (ID: 205)

## Best Practices

### When Creating Tests from JIRA Tickets:

1. **For ESWCTV tickets:**
   - Use Unified OAO project in TestRail
   - Look for CTV-specific test suites or create in CTV section
   - Tag or name tests to indicate CTV platform

2. **For ESROKU tickets:**
   - Use Unified OAO project in TestRail
   - Look for Roku-specific test suites or create in Roku section
   - Tag or name tests to indicate Roku platform

3. **Platform-Specific Organization:**
   - Tests may be organized by:
     - Platform (Web, Roku, CTV, Mobile)
     - Feature area (Authentication, Video Player, Navigation)
     - Test type (Smoke, Regression, Feature)

### Using the TestRail Browser:

1. **Review Mode:**
   - When working on ESWCTV ticket, review CTV-related sections in Unified OAO
   - When working on ESROKU ticket, review Roku-related sections in Unified OAO
   - This helps avoid duplicate tests across platforms

2. **Save Mode:**
   - Select appropriate platform-specific section in Unified OAO
   - Create clear folder structure: Platform > Feature > Test Type

3. **Automate Mode:**
   - Can select tests from multiple platforms if automating cross-platform features
   - Filter by platform-specific sections when automating platform-specific tests

## Common Patterns

### Shared Tests
Some tests may apply to multiple platforms (e.g., login, search). These are typically:
- Stored in a common/shared section
- Tagged with multiple platforms
- Referenced by platform-specific test suites

### Platform-Specific Tests
Tests unique to a platform (e.g., Roku remote navigation, CTV 10-foot UI):
- Stored in platform-specific sections
- Named with platform prefix (e.g., "ROKU_", "CTV_")
- May have platform-specific test data

## Tips for Test Organization

1. **Naming Convention:**
   - Include platform identifier in test names when relevant
   - Example: "CTV_VideoPlayer_AutoPlay" vs "ROKU_VideoPlayer_AutoPlay"

2. **Section Structure:**
   ```
   Unified OAO/
   ├── Common/
   │   ├── Authentication/
   │   ├── Search/
   │   └── User Profile/
   ├── CTV/
   │   ├── Navigation/
   │   ├── Video Player/
   │   └── Remote Control/
   ├── Roku/
   │   ├── Navigation/
   │   ├── Video Player/
   │   └── Remote Control/
   └── Web/
       ├── Desktop/
       └── Mobile/
   ```

3. **Cross-Platform Testing:**
   - Identify tests that should run on all platforms
   - Create platform-specific variations when behavior differs
   - Use test case fields to indicate supported platforms

## Automation Considerations

When converting TestRail tests to Cypress:
- Platform-specific tests may need different selectors
- Consider creating page objects per platform
- Use environment variables to switch between platforms
- Tag tests with platform identifiers for selective execution

---

*Last Updated: September 1, 2025*
*This document should be updated as new project mappings are discovered*