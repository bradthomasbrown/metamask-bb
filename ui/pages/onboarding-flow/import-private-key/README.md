Initial setup using an existing EVM private key
=============================================

The welcome screen offers this option alongside recovery-phrase import. The
entered key remains in component memory until password creation. It is passed
directly to the background API and never placed in Redux or route parameters.
The existing password form uses private-key backup wording for this flow.

The background service refuses existing vaults, completed onboarding, and social
login. A pinned Yarn patch adds atomic private-key initialization to the keyring
controller, using its existing encryption, persistence, rollback, and mutex code.
Only a Simple Key Pair keyring is created; no mnemonic is generated.

Reopening an unfinished setup proceeds to unlocking or the remaining consent
and completion pages. Recovery settings explain that there is no recovery
phrase when the vault has no HD keyrings. Importing an SRP later remains an
explicit separate user action.
