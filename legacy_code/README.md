# Legacy Code

This folder contains the original vanilla JavaScript and Node.js code that has been migrated to Next.js.

## Contents

### Backend (Node.js)
- **server.js** - Original custom Node.js HTTP server with all API routes
- **db.js** - Original SQLite database operations
- **data/** - SQLite database files

### Frontend (Vanilla JavaScript)
- **index.html** - Original HTML structure
- **style.css** - Original CSS styles (now in src/app/globals.css)
- **js/** - Original JavaScript modules:
  - **js/app.js** - Main application logic
  - **js/engine/** - Game engine modules (flight-canvas, crash-math, global-sync, audio)
  - **js/features/** - Feature modules (staking, auth-manager, firebase-config)
  - **js/components/** - UI components (history-bar, live-stakers)

### Tests
- **check_syntax.js** - Syntax checking utility
- **test_client_ui.js** - Client UI tests
- **test_demo_account.js** - Demo account tests
- **test_firebase_phone_otp.js** - Firebase OTP tests
- **test_real_money_db.js** - Real money database tests

### Deployment
- **CNAME** - GitHub Pages custom domain configuration

## Migration Status

All code in this folder has been successfully migrated to:
- **Backend**: Next.js API routes in `src/app/api/`
- **Frontend**: React components in `src/components/`
- **Database**: PostgreSQL with Prisma ORM in `prisma/`
- **Styling**: CSS in `src/app/globals.css`

## Why Keep This?

This folder is preserved for:
- Reference during development
- Comparison of old vs new implementation
- Rollback if needed
- Documentation of original implementation

## Do Not Modify

Code in this folder should not be modified. All development should happen in the `src/` directory.
