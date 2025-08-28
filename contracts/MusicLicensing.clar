;; TrackContract: NFT-based Music Track Management
;; This contract implements SIP-009 NFT standard for music tracks on Stacks.
;; It allows artists to mint tracks as NFTs with metadata, manage ownership,
;; add versions, licenses, categories, collaborators, status, and revenue shares.
;; Designed for TuneLicense marketplace integration.

;; Traits
(use-trait nft-trait .sip-009.nft-trait)

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-REGISTERED u101)
(define-constant ERR-INVALID-PARAM u102)
(define-constant ERR-NOT-OWNER u103)
(define-constant ERR-NOT-FOUND u104)
(define-constant ERR-PAUSED u105)
(define-constant ERR-METADATA-TOO-LONG u106)
(define-constant ERR-INVALID-SHARE u107)
(define-constant MAX-METADATA-LEN u1024)
(define-constant MAX-TAGS u10)
(define-constant MAX-PERMISSIONS u5)
(define-constant CONTRACT-OWNER tx-sender)

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var last-token-id uint u0)
(define-data-var admin principal tx-sender)

;; Data Maps
(define-map tracks
    { token-id: uint }
    {
        owner: principal,
        metadata: (buff 1024),  ;; IPFS hash or JSON metadata
        timestamp: uint,
        title: (string-utf8 100),
        description: (string-utf8 500)
    }
)

(define-map version-registry
    { token-id: uint, version: uint }
    {
        updated-metadata: (buff 1024),
        update-notes: (string-utf8 200),
        timestamp: uint
    }
)

(define-map licenses
    { token-id: uint, licensee: principal }
    {
        expiry: uint,
        terms: (string-utf8 200),
        active: bool
    }
)

(define-map work-categories
    { token-id: uint }
    {
        category: (string-utf8 50),
        tags: (list 10 (string-utf8 20))
    }
)

(define-map collaborators
    { token-id: uint, collaborator: principal }
    {
        role: (string-utf8 50),
        permissions: (list 5 (string-utf8 20)),
        added-at: uint
    }
)

(define-map work-status
    { token-id: uint }
    {
        status: (string-utf8 20),
        visibility: bool,
        last-updated: uint
    }
)

(define-map revenue-shares
    { token-id: uint, participant: principal }
    {
        percentage: uint,
        total-received: uint
    }
)

;; Private Functions
(define-private (is-owner (token-id uint) (caller principal))
    (match (map-get? tracks {token-id: token-id})
        track (is-eq (get owner track) caller)
        false
    )
)

(define-private (is-admin (caller principal))
    (is-eq caller (var-get admin))
)

(define-private (check-paused)
    (if (var-get contract-paused)
        (err ERR-PAUSED)
        (ok true)
    )
)

;; Public Functions - SIP-009 Implementation
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (try! (check-paused))
        (asserts! (is-eq tx-sender sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-owner token-id sender) (err ERR-NOT-OWNER))
        (map-set tracks
            {token-id: token-id}
            (merge (unwrap-panic (map-get? tracks {token-id: token-id}))
                {owner: recipient})
        )
        (ok true)
    )
)

(define-public (get-owner (token-id uint))
    (ok (get owner (map-get? tracks {token-id: token-id})))
)

(define-public (get-last-token-id)
    (ok (var-get last-token-id))
)

(define-public (get-token-uri (token-id uint))
    (ok (some (get metadata (map-get? tracks {token-id: token-id}))))
)

;; Additional Public Functions
(define-public (mint-track (metadata (buff 1024)) (title (string-utf8 100)) (description (string-utf8 500)))
    (let
        (
            (new-id (+ (var-get last-token-id) u1))
        )
        (try! (check-paused))
        (asserts! (<= (len metadata) MAX-METADATA-LEN) (err ERR-METADATA-TOO-LONG))
        (map-set tracks
            {token-id: new-id}
            {
                owner: tx-sender,
                metadata: metadata,
                timestamp: block-height,
                title: title,
                description: description
            }
        )
        (var-set last-token-id new-id)
        (ok new-id)
    )
)

(define-public (register-new-version (token-id uint) (new-metadata (buff 1024)) (version uint) (notes (string-utf8 200)))
    (begin
        (try! (check-paused))
        (asserts! (is-owner token-id tx-sender) (err ERR-NOT-OWNER))
        (asserts! (<= (len new-metadata) MAX-METADATA-LEN) (err ERR-METADATA-TOO-LONG))
        (map-set version-registry
            {token-id: token-id, version: version}
            {
                updated-metadata: new-metadata,
                update-notes: notes,
                timestamp: block-height
            }
        )
        (ok true)
    )
)

(define-public (grant-license (token-id uint) (licensee principal) (duration uint) (terms (string-utf8 200)))
    (begin
        (try! (check-paused))
        (asserts! (is-owner token-id tx-sender) (err ERR-NOT-OWNER))
        (map-set licenses
            {token-id: token-id, licensee: licensee}
            {
                expiry: (+ block-height duration),
                terms: terms,
                active: true
            }
        )
        (ok true)
    )
)

(define-public (add-work-category (token-id uint) (category (string-utf8 50)) (tags (list 10 (string-utf8 20))))
    (begin
        (try! (check-paused))
        (asserts! (is-owner token-id tx-sender) (err ERR-NOT-OWNER))
        (asserts! (<= (len tags) MAX-TAGS) (err ERR-INVALID-PARAM))
        (map-set work-categories
            {token-id: token-id}
            {category: category, tags: tags}
        )
        (ok true)
    )
)

(define-public (add-collaborator (token-id uint) (collaborator principal) (role (string-utf8 50)) (permissions (list 5 (string-utf8 20))))
    (begin
        (try! (check-paused))
        (asserts! (is-owner token-id tx-sender) (err ERR-NOT-OWNER))
        (asserts! (<= (len permissions) MAX-PERMISSIONS) (err ERR-INVALID-PARAM))
        (map-set collaborators
            {token-id: token-id, collaborator: collaborator}
            {
                role: role,
                permissions: permissions,
                added-at: block-height
            }
        )
        (ok true)
    )
)

(define-public (update-work-status (token-id uint) (status (string-utf8 20)) (visibility bool))
    (begin
        (try! (check-paused))
        (asserts! (is-owner token-id tx-sender) (err ERR-NOT-OWNER))
        (map-set work-status
            {token-id: token-id}
            {
                status: status,
                visibility: visibility,
                last-updated: block-height
            }
        )
        (ok true)
    )
)

(define-public (set-revenue-share (token-id uint) (participant principal) (share-percentage uint))
    (begin
        (try! (check-paused))
        (asserts! (is-owner token-id tx-sender) (err ERR-NOT-OWNER))
        (asserts! (<= share-percentage u100) (err ERR-INVALID-SHARE))
        (map-set revenue-shares
            {token-id: token-id, participant: participant}
            {
                percentage: share-percentage,
                total-received: u0
            }
        )
        (ok true)
    )
)

(define-public (pause-contract)
    (begin
        (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
        (var-set contract-paused true)
        (ok true)
    )
)

(define-public (unpause-contract)
    (begin
        (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
        (var-set contract-paused false)
        (ok true)
    )
)

(define-public (set-admin (new-admin principal))
    (begin
        (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
        (var-set admin new-admin)
        (ok true)
    )
)

;; Read-Only Functions
(define-read-only (get-track-details (token-id uint))
    (map-get? tracks {token-id: token-id})
)

(define-read-only (get-version-details (token-id uint) (version uint))
    (map-get? version-registry {token-id: token-id, version: version})
)

(define-read-only (get-license-details (token-id uint) (licensee principal))
    (map-get? licenses {token-id: token-id, licensee: licensee})
)

(define-read-only (get-category (token-id uint))
    (map-get? work-categories {token-id: token-id})
)

(define-read-only (get-collaborator (token-id uint) (collaborator principal))
    (map-get? collaborators {token-id: token-id, collaborator: collaborator})
)

(define-read-only (get-status (token-id uint))
    (map-get? work-status {token-id: token-id})
)

(define-read-only (get-revenue-share (token-id uint) (participant principal))
    (map-get? revenue-shares {token-id: token-id, participant: participant})
)

(define-read-only (is-contract-paused)
    (var-get contract-paused)
)