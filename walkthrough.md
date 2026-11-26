# Security Summary

**Reviewed Files**: 20  
**Issues Resolved**: 8  

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Deployment & ES Module Resolution | `src/data/mockData.ts` | 1 | Directory import without explicit file extension (`../types`) caused Node 22 ESM loader crash (`ERR_UNSUPPORTED_DIR_IMPORT`). | High | Fixed | Extracted user authorization seeds to `authorizedUsersData.ts` and set explicit module paths (`../types/index.ts`). |
| Deployment Production Startup | `server.ts` | 11 | Backend entry point imported large frontend mock dataset with directory references, preventing production container boot. | High | Fixed | Re-routed import to isolated server-safe `authorizedUsersData.ts`. |
| Firestore Unbounded Read Burst | `src/services/firebaseSync.ts` | 1522 | `getDocs(collection('school_classes_2027'))` and `onSnapshot` on the whole collection downloaded 40 classes on every edit for all 100 users, exhausting the 50,000 daily read quota. | High | Fixed | Replaced collection `onSnapshot` with `getDoc` cache reads and paginated `getDocs` (`limit(20)` + `startAfter` + `classIds`/`teacherEmail` filters), leaving only a single throttled `onSnapshot` on `school_meta_2027/state`. |
| Alert Snapshot Listener Overuse | `src/services/fcmService.ts` | 764 | Persistent open `onSnapshot` listener on `school_fcm_alerts_2027` kept continuous sockets and read cycles active for all clients. | Medium | Fixed | Replaced with one-time `getDocs(query(..., orderBy('createdAtMs', 'desc'), limit(10)))` on login/mount. |
| React Effect Re-Subscription Leak | `src/components/PushNotificationCenter.tsx` | 164 | `useEffect` depended on `visibleClasses` and inline `onNavigateScreen`, tearing down and re-running `subscribeToFcmNotifications` (`getDocs` on alerts) on every attendance click. | High | Fixed | Stabilized callbacks and class/window state via `useRef` and primitive string keys so FCM/alert initialization runs only on user identity changes. |
| React Effect Interval Churn | `src/App.tsx`, `src/components/DiasLetivosScreen.tsx` | 812, 286 | `App.tsx` depended on `authorizedUsers` inside the auto-revocation `useEffect` (which already read `authorizedUsersRef.current`), and `DiasLetivosScreen` depended on inline `onUpdateClasses`, recreating timers on every heartbeat or re-render. | Medium | Fixed | Removed `authorizedUsers` from `App.tsx` deps; moved `onUpdateClasses` to a ref in `DiasLetivosScreen.tsx` and skipped background polling in static Firebase mode. |
| On-Demand Pagination Missing | `src/App.tsx`, `src/components/MinhasTurmasScreen.tsx` | 690, 445 | Static hosting lacked a cursor-based loader beyond the initial `limit(20)` page when viewing all school classes. | Medium | Fixed | Wired `fetchClassesFromFirestorePaginated` (`startAfter` + `limit(20)`) with a "Carregar mais turmas da nuvem (+20)" action in `MinhasTurmasScreen.tsx`, and scoped PEB I users to their assigned `classIds`/`teacherEmail`. |
| Firebase Storage Bandwidth & Quotas | `src/services/firebaseStorage.ts`, `src/services/db.ts` | 1, 2875 | Static hosting uploads bypassed Firebase Storage, lacked `cacheControl: 'public, max-age=86400'`, and did not enforce HTML5 Canvas resizing (`<=1280px`) + WebP `0.8` conversion. | Medium | Fixed | Implemented `resizePhotoWithCanvasToWebp` (max 1280px, WebP 0.8) and `uploadFileWithCacheControl` (`public, max-age=86400`), routing static photo/PDF uploads in `db.ts` through Firebase Storage. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Institutional Identity & Access Control | `server.ts`, `firestore.rules` | Cryptographically verifies Firebase ID tokens (`RS256` via Google securetoken certs) and server HMAC-signed session cookies. Non-institutional or deactivated accounts are strictly rejected. |
| Role-Based Access Control (RBAC) | `server.ts`, `firestore.rules` | Administrative mutations (`/api/admin/*`, calendar changes, class resets) enforce verified school administration email (`emebjfreitas@jundiai.sp.gov.br`), while PEB I teachers can only update their assigned classes. |
| Prototype Pollution & Payload Sanitization | `src/utils/serverValidation.ts` | Recursively blocks prototype poisoning keys (`__proto__`, `constructor`, `prototype`) and bounds JSON payload depths across all API mutation endpoints. |
| LGPD & Sensitive Data Protection | `src/services/securityAuditService.ts`, `src/utils/reportBuilders.ts` | Enforces student PII masking (names, CPF, RA, guardian contacts) based on institutional LGPD configuration, preventing leakage in exports and logs. |
| Offline Cache & Multi-Tab Persistence | `src/services/firebaseSync.ts` | Configures `persistentLocalCache` with `persistentMultipleTabManager` and `CACHE_SIZE_UNLIMITED`, enabling browser tabs to share IndexedDB cache without consuming network reads. |
| Paginated Queries & Filters | `src/services/firebaseSync.ts`, `src/App.tsx` | Enforces `limit(20)` and `startAfter` on class queries, plus targeted document reads (`classIds` / `where('teacherEmail', '==', ...)`) for teacher-assigned classes. |
| Storage Cache-Control & WebP 1280px | `src/services/firebaseStorage.ts`, `src/utils/photoCompressor.ts`, `src/services/db.ts` | Guarantees `cacheControl: 'public, max-age=86400'` and HTML5 Canvas resize (max 1280px, WebP 0.8) prior to upload. |

## PoC Verification

### 1. Node ESM Directory Import Crash on Cloud Run

#### Summary
| Field | Value |
|---|---|
| Issue Type | Runtime ES Module Resolution Failure / Service Boot Halt |
| Impact | High |
| Affected File | `src/data/mockData.ts:1`, `server.ts:11` |
| Test Scenario | Executing `node server.ts` directly under Node.js v22.23.x runtime in production container |

#### How It Was Fixed
Isolated `INITIAL_AUTHORIZED_USERS` into `src/data/authorizedUsersData.ts` with explicit type references (`../types/index.ts`), updated `server.ts` to consume the isolated module, and updated `src/data/mockData.ts` and `src/utils/attendanceRules.ts` with strict ES module resolution.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Container boots with `npm run start` (`node server.ts`) | Node 22 ESM loader initializes |
| 2 | Reaches module import at `server.ts:11` (`./src/data/authorizedUsersData.ts`) | Imports resolve cleanly with zero directory ambiguities |
| 3 | Final result | **Handled Safely** (Server starts and responds HTTP 200 on `/api/health`) |

#### Conclusion
**Fix Verified** - The server boots successfully under native Node 22 ESM without directory import errors and passes all test suites.

### 2. Firestore Daily Read Quota & React Effect Stability Protection

#### Summary
| Field | Value |
|---|---|
| Issue Type | Read Amplification, Effect Re-Subscription Churn & Quota Exhaustion (50k daily limit) |
| Impact | High |
| Affected File | `src/services/firebaseSync.ts:1547`, `src/components/PushNotificationCenter.tsx:164`, `src/App.tsx:807` |
| Test Scenario | 100 concurrent users modifying attendance and syncing classes |

#### How It Was Fixed
Removed collection-wide `onSnapshot` on 40 classes and `school_fcm_alerts_2027`. Enabled `persistentLocalCache` (`CACHE_SIZE_UNLIMITED`) across tabs. Configured paginated `limit(20)` + `startAfter` queries, scoped teacher queries (`classIds` / `teacherEmail`), and stabilized `PushNotificationCenter`, `App.tsx`, and `DiasLetivosScreen` `useEffect` dependencies using refs and primitive keys.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Client opens app | Reads `state` and `config` from local IndexedDB cache (`0` network reads when cached) |
| 2 | Teacher toggles attendance cell | `PushNotificationCenter` and `App` effects remain stable; zero `getDocs` alert spikes or interval teardowns occur |
| 3 | Admin loads additional classes | Initial load caps at `limit(20)`; extra pages fetch on-demand via `startAfter` cursor |
| 4 | Final result | **Handled Safely** (Reduces daily read volume dramatically, staying safely within Spark plan limits) |

### 3. Firebase Storage Pre-Upload Compression & Cache-Control Enforcement

#### Summary
| Field | Value |
|---|---|
| Issue Type | Storage Download Bandwidth Exhaustion (1 GB/day Spark limit) |
| Impact | Medium |
| Affected File | `src/services/firebaseStorage.ts:29`, `src/services/db.ts:2885` |
| Test Scenario | Uploading student photos and PDF records in static Firebase Hosting mode |

#### How It Was Fixed
Enforced `resizePhotoWithCanvasToWebp(..., 1280, 0.8)` prior to photo uploads and applied `cacheControl: 'public, max-age=86400'` in `SettableMetadata` across all `uploadBytes`/`uploadBytesResumable` calls in `firebaseStorage.ts`, wired into `db.ts`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Educator uploads 4K photo (`>1280px`) | HTML5 Canvas downscales proportionally to max `1280px` and encodes to WebP `0.8` |
| 2 | Upload reaches Firebase Storage | Metadata stores `cacheControl: 'public, max-age=86400'` |
| 3 | Final result | **Handled Safely** (Subsequent views across the day hit browser/CDN cache instead of Storage download quota) |
