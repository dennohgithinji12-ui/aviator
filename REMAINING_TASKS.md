# Migration Progress - Remaining Tasks

> **Audit update (2026-11-05):** This checklist was stale. Several listed flows are only UI shells or browser simulations, even though API routes exist. The current app also had a pre-round crash-result leak and wallet routes trusted client-supplied account and payout values. See the ordered delivery plan at the end of this file. Do not treat the items marked “route exists” as production complete.

## ✅ COMPLETED

### Phase 1-3: Backend & Database ✅
- ✅ Next.js 16.4.5 project setup with TypeScript
- ✅ Prisma 7 ORM with PostgreSQL adapter
- ✅ Local PostgreSQL database (Laragon) created and connected
- ✅ Database schema pushed (Users, Deposits, Bets, Withdrawals, PasswordResets, StkAttempts)
- ✅ Database seeded with demo data
- ✅ All 19 API routes migrated and working
- ✅ PayHero API client wrapper
- ✅ Firebase configuration module

### Phase 4: Game Engine ✅
- ✅ FlightCanvas engine converted to TypeScript (814 lines)
- ✅ CrashMathEngine converted to TypeScript (123 lines)
- ✅ GlobalRoundSyncEngine converted to TypeScript (248 lines)
- ✅ Audio engine converted to TypeScript (799 lines)
- ✅ All game engines preserved with original logic

### Phase 5: Authentication ✅
- ✅ JWT authentication system implemented
- ✅ Password hashing with bcrypt
- ✅ Auth manager converted to TypeScript
- ✅ Firebase config converted to TypeScript
- ✅ AuthModal UI component created
- ✅ AuthContext for global state management
- ✅ Session persistence in localStorage
- ✅ Real/Fun mode switching based on auth state

### Phase 6: Frontend Components ✅
- ✅ Header component created
- ✅ AviatorConsole component created
- ✅ FlightCanvas React wrapper created
- ✅ BettingTerminal component created (manual/auto modes)
- ✅ DualBettingTerminals component created
- ✅ LiveStakers component created (All Bets, Previous, Top tabs)
- ✅ CSS preserved and fixed (globals.css)
- ✅ Auth modal CSS styling
- ✅ Real/Fun mode banner styling

### Build & Deployment ✅
- ✅ Production build successful
- ✅ TypeScript compilation successful
- ✅ Dev server running on http://localhost:3000
- ✅ Database connection verified

---

## ⏳ REMAINING TASKS

### Priority 1: UI Fidelity & Layout Matching

**Issue**: User reported UI "looks nothing like the older version"

#### 1.1 Header Navigation Enhancement
- [ ] Add navigation links (Terminal, Liquidity, Rollover, Account)
- [ ] Add user profile display with avatar
- [ ] Add real-time balance display in header
- [ ] Add deposit/withdrawal quick action buttons
- [ ] Match original header layout exactly

#### 1.2 Mobile Bottom Navigation
- [ ] Create mobile bottom navigation component
- [ ] Add icons for Home, Terminal, Wallet, Profile
- [ ] Responsive design for mobile screens
- [ ] Match original mobile layout

#### 1.3 Round History Ribbon
- [ ] Create multiplier history ribbon component
- [ ] Show last 20 round multipliers with color coding
- [ ] Add animated scrolling effect
- [ ] Match original history bar design

#### 1.4 Account Hub View
- [ ] Create account hub page (`/account`)
- [ ] Profile display with phone number
- [ ] Balance breakdown (Real vs Demo)
- [ ] Transaction history (deposits, withdrawals, bets)
- [ ] Settings section

#### 1.5 Liquidity Vault View
- [ ] Create liquidity vault page (`/liquidity`)
- [ TVL display
- [ ] APY display
- [ ] Staking position card
- [ ] Deposit/withdraw liquidity buttons

#### 1.6 Rollover Vault View
- [ ] Create rollover vault page (`/rollover`)
- [ ] Challenge parameters form
- [ ] Progression ladder display
- [ ] Start/stop challenge buttons

---

### Priority 2: Feature Integration

#### 2.1 Deposit Modal
- [ ] Create deposit modal component
- [ ] Phone number input (pre-filled from user)
- [ ] Amount input with validation
- [ ] PayHero STK push integration
- [ ] Success/failure handling
- [ ] Balance update on success

#### 2.2 Withdrawal Modal
- [ ] Create withdrawal modal component
- [ ] Amount input with max balance
- [ ] AML risk check display
- [ ] Tax calculation (5% gaming tax)
- [ ] Confirmation dialog
- [ ] Balance update on success

#### 2.3 Promo Claims
- [ ] Create signup bonus claim component
- [ ] Create casino bonus claim component
- [ ] Integration with promo API routes
- [ ] Success/failure feedback
- [ ] Balance update on claim

#### 2.4 Game State Integration
- [ ] Connect betting terminals to actual `/api/wallet/bet` endpoint
- [ ] Connect cashout to `/api/wallet/cashout` endpoint
- [ ] Connect withdrawal to `/api/wallet/withdraw` endpoint
- [ ] Real-time balance updates from API
- [ ] Error handling for failed transactions

#### 2.5 Firebase Phone Auth
- [ ] Integrate actual Firebase OTP sending
- [ ] Add OTP input modal
- [ ] Verify OTP code
- [ ] Fallback to password if Firebase fails
- [ ] Sandbox mode handling

---

### Priority 3: PayHero Payment Integration

#### 3.1 PayHero Configuration
- [ ] Add actual PayHero API keys to `.env.local`
- [ ] Test STK push endpoint
- [ ] Test status check endpoint
- [ ] Test callback endpoint
- [ ] Test receipt verification

#### 3.2 Payment Flow Testing
- [ ] Test deposit flow end-to-end
- [ ] Test withdrawal flow end-to-end
- [ ] Test error handling (insufficient funds, AML blocks)
- [ ] Test callback handling
- [ ] Test receipt verification

---

### Priority 4: User Experience Enhancements

#### 4.1 Loading States
- [ ] Add loading spinners for async operations
- [ ] Add skeleton screens for data loading
- [ ] Add button loading states
- [ ] Add toast notifications for actions

#### 4.2 Error Handling
- [ ] Add global error boundary
- [ ] Add API error handling with user-friendly messages
- [ ] Add network error handling
- [ ] Add validation error display

#### 4.3 Form Validation
- [ ] Add phone number format validation
- [ ] Add amount validation (min/max limits)
- [ ] Add password strength validation
- [ ] Add real-time validation feedback

#### 4.4 Notifications
- [ ] Create toast notification system
- [ ] Success notifications (bets placed, deposits received)
- [ ] Error notifications (insufficient funds, API errors)
- [ ] Info notifications (round started, crashed)

---

### Priority 5: Responsive Design

#### 5.1 Mobile Optimization
- [ ] Test on mobile devices
- [ ] Adjust canvas size for mobile
- [ ] Adjust terminal layout for mobile
- [ ] Touch-friendly button sizes
- [ ] Mobile-specific CSS adjustments

#### 5.2 Tablet Optimization
- [ ] Test on tablet devices
- [ ] Adjust layout for tablets
- [ ] Responsive breakpoints

---

### Priority 6: Testing & QA

#### 6.1 Functional Testing
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test betting in Demo mode
- [ ] Test betting in Real mode
- [ ] Test cashout flow
- [ ] Test deposit flow
- [ ] Test withdrawal flow
- [ ] Test auto-bet mode
- [ ] Test auto-cashout mode

#### 6.2 Integration Testing
- [ ] Test database persistence
- [ ] Test API endpoints
- [ ] Test authentication across page refreshes
- [ ] Test session expiration
- [ ] Test concurrent betting (both terminals)

#### 6.3 Performance Testing
- [ ] Test with 100+ stakers
- [ ] Test canvas performance
- [ ] Test API response times
- [ ] Optimize bundle size

---

### Priority 7: Deployment

#### 7.1 Vercel Deployment
- [ ] Configure Vercel project
- [ ] Set up environment variables in Vercel
- [ ] Connect to Neon PostgreSQL (or use alternative)
- [ ] Deploy to Vercel
- [ ] Test production build
- [ ] Configure custom domain (if needed)

#### 7.2 Production Configuration
- [ ] Set production JWT secret
- [ ] Set production PayHero keys
- [ ] Set production Firebase config
- [ ] Enable production mode
- [ ] Configure rate limiting
- [ ] Set up monitoring

---

### Priority 8: Documentation

#### 8.1 User Documentation
- [ ] How to play guide
- [ ] Deposit/withdrawal instructions
- [ ] FAQ section
- [ ] Support contact info

#### 8.2 Developer Documentation
- [ ] API documentation
- [ ] Database schema documentation
- [ ] Deployment guide
- [ ] Contribution guidelines

---

## Estimated Effort

- **Priority 1 (UI Fidelity)**: 8-12 hours
- **Priority 2 (Feature Integration)**: 6-8 hours
- **Priority 3 (PayHero)**: 4-6 hours
- **Priority 4 (UX)**: 4-6 hours
- **Priority 5 (Responsive)**: 3-4 hours
- **Priority 6 (Testing)**: 4-6 hours
- **Priority 7 (Deployment)**: 2-4 hours
- **Priority 8 (Documentation)**: 2-3 hours

**Total Estimated**: 33-49 hours (4-6 days)

---

## Current State Summary

**Working**: 
- Game canvas rendering
- Round synchronization
- Betting terminals UI
- Live stakers feed
- Authentication (JWT)
- Database connection
- Demo mode betting

**Not Yet Working**:
- Real mode betting (needs API integration)
- Deposits (needs PayHero integration)
- Withdrawals (needs PayHero integration)
- Phone OTP (needs Firebase integration)
- Account hub page
- Liquidity vault page
- Rollover vault page
- Mobile navigation
- Round history ribbon

---

## Step-by-step plan to finish the migration

Order follows data integrity and money movement first; visual completion follows once those flows are dependable.

### Step 1 — Finish the round and bet lifecycle (in progress)

- [x] Stop returning the active round’s crash multiplier from the public round-state response.
- [x] Use a server-only master secret, per-round seed commitments, and reveal each round seed only after the crash.
- [x] Make the browser use the server’s current phase and multiplier rather than recomputing the crash result from a client-side secret.
- [x] Require a signed-in session for recorded bets and cashouts; derive the account from the JWT.
- [x] Debit stakes atomically, reject duplicate terminal bets in a round, and enforce server round timing.
- [x] Calculate payout on the server from the active round; ignore client payout/multiplier claims.
- [x] Support independent bets on both terminals and wire auto-bet / auto-cashout controls.
- [x] Add cancellation before takeoff and restore the stake atomically.
- [ ] Persist round outcomes and settle all uncashed bets as losses when the server round crashes, including users who disconnect.
- [ ] Persist the round schedule/state in shared storage so multiple server instances cannot diverge during deployment.
- [ ] Add idempotency keys and transaction-level concurrency checks for placement, cashout, and cancellation.
- [ ] Add server-side limits for request frequency and maximum payout exposure.

**Done when:** concurrent requests cannot debit or pay twice; reconnecting users see the right bet state; no active wager is left unsettled; all instances agree on the same round.

### Step 2 — Make the live-bets panel reflect real play

- [x] Add a masked, read-only `/api/live-bets?roundNonce=...` feed backed by database records.
- [x] Replace generated “community” bets and fabricated top wins in `LiveStakers` with the real feed.
- [x] Show database-backed round totals, active/won/lost state when settled, and server-confirmed cashout multiplier and payout.
- [ ] Show the signed-in user’s persisted history rather than session-only history.
- [x] Add an empty state and poll the recorded feed at a measured interval.
- [ ] Add visible loading and error states or move the feed to a push channel.
- [ ] Keep phone numbers and account details masked in every public feed.

**Done when:** every row can be traced to a real database bet and the totals match the API for the current round.

### Step 3 — Integrate the predictor safely

- [x] Add `/predictor` and `/api/predictor` in Next.js as a live round monitor.
- [x] Remove the former APK’s reliance on an unrevealed crash result; only publish the final multiplier after the round ends.
- [x] Label the monitor clearly: randomized crash outcomes cannot be reliably forecast from prior rounds.
- [ ] Decide whether to keep the legacy APK as a redirect to `/predictor` or retire its “100% accuracy” claims and stale bundled data.
- [ ] Add a stored, independently verifiable round history before presenting any retrospective statistics.

**Done when:** the integrated page never exposes a future outcome or presents fabricated confidence / win-rate claims.

### Step 4 — Complete the admin dashboard and its API

- [x] Add `/admin` and a read-only `/api/admin/dashboard` endpoint for high-level wallet and bet metrics.
- [x] Protect the endpoint with `ADMIN_API_KEY`; it fails closed when the key is unset and masks phone numbers.
- [ ] Set a strong unique `ADMIN_API_KEY` in local and production secret stores; never commit it.
- [ ] Add pagination/date filters and CSV export for bets, deposits, withdrawals, and users.
- [ ] Add role-based admin accounts and audit logs before adding any write actions.
- [ ] Add payment callback health, pending payment counts, active round health, and recent server errors.

**Done when:** an admin can audit activity without changing balances, and every future admin mutation is permissioned and logged.

### Step 5 — Finish real-money payment and wallet flows

- [ ] Complete PayHero STK initiation, callback signature verification, idempotent deposit crediting, and status reconciliation.
- [ ] Add deposit modal, pending/failed/success states, receipt details, and refreshed wallet balance.
- [ ] Complete withdrawal checks and provider payout/reconciliation; verify tax and AML rules with the business owner before enabling real payouts.
- [ ] Make all balance changes transactional and write a ledger entry for every credit/debit.
- [ ] Test duplicate callbacks, delayed callbacks, invalid signatures, provider timeouts, and insufficient funds.

**Blockers:** real PayHero credentials, callback URL/domain, production database, and confirmed withdrawal/tax policy. Do not infer successful payment from a browser response.

### Step 6 — Complete account and vault UI

- [ ] Add account hub with profile, real/demo balance, transaction history, and settings.
- [ ] Add liquidity and rollover pages only after their database models, rules, and settlement behavior are defined.
- [ ] Add responsive navigation, mobile bottom bar, live round history ribbon, and direct deposit/withdraw actions.
- [ ] Remove placeholder marketing counters and ensure each balance/stat is sourced from real data.

### Step 7 — Finish authentication and account security

- [ ] Integrate Firebase Admin token verification on the server and Firebase OTP challenge/verification in the client.
- [ ] Revalidate local sessions against server state and add logout/session expiry behavior.
- [ ] Add secure cookies or another protected token storage approach, login throttling, and password reset safeguards.
- [ ] Add explicit admin roles; ordinary users must not gain administrator access through user-editable fields.

**Blocker:** Firebase project credentials and approved production auth configuration.

### Step 8 — Release verification and production setup

- [ ] Run type check and production build; fix all failures.
- [ ] Exercise signup/login, demo and real bet, two simultaneous terminals, cancel, manual cashout, auto-bet, auto-cashout, crash loss, wallet refresh, deposit, withdrawal, and callbacks.
- [ ] Verify multi-instance round synchronization, database transaction behavior, mobile layout, and API rate limits.
- [ ] Configure production PostgreSQL, JWT and game secrets, Firebase, PayHero, admin key, domain and callback URLs.
- [ ] Deploy to Vercel and run a production smoke check before enabling real-money mode.

### Step 9 — Finish support and operating documentation

- [ ] Document game rules, wallet flows, payout timing, limitations, and support contact.
- [ ] Document environment setup, migrations, admin access, API contracts, deployment, and incident recovery.
- [ ] Add monitoring/alerts for payment callbacks, round drift, database failures, and unresolved bets.

### Current delivery status

- **Implemented in this pass:** secured admin overview API and `/admin` UI; admin key example; recorded bet placement, cancellation and server-calculated cashout wiring; round-state masking; live database bets in the public feed; honest Next.js round monitor/predictor endpoint; header link.
- **Still required before production:** settle lost bets across disconnects, shared/persisted round authority, wire the real live-bets API into the feed, complete wallet/provider integration, Firebase server verification, and run full release verification.
- **External setup required:** `ADMIN_API_KEY`, production `JWT_SECRET` and `GAME_MASTER_SECRET`, PostgreSQL credentials, Firebase service account, PayHero credentials, and confirmed payout/tax policy.

**Critical Path to Production**:
1. Integrate betting terminals with API (Priority 2.4)
2. Add deposit modal with PayHero (Priority 2.1 + 3.1)
3. Add withdrawal modal (Priority 2.2 + 3.1)
4. Add Firebase phone auth (Priority 2.5)
5. Test end-to-end flows (Priority 6.1)
6. Deploy to Vercel (Priority 7.1)
