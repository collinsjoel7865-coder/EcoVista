;; nft-minter.clar
;; EcoVista NFT Minter Contract
;; This contract handles the minting and management of eco-NFTs representing virtual ownership of protected natural areas.
;; It ensures uniqueness, ties NFTs to real-world data, and provides admin controls for secure operation.

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-PAUSED (err u101))
(define-constant ERR-INVALID-AREA-ID (err u102))
(define-constant ERR-INVALID-METADATA (err u103))
(define-constant ERR-NFT-ALREADY-EXISTS (err u104))
(define-constant ERR-INVALID-RECIPIENT (err u105))
(define-constant ERR-INVALID-MINTER (err u106))
(define-constant ERR-ALREADY-REGISTERED (err u107))
(define-constant ERR-METADATA-TOO-LONG (err u108))
(define-constant ERR-INVALID-GPS (err u109))
(define-constant ERR-INVALID-GOALS (err u110))
(define-constant ERR-INVALID-ROYALTY (err u111))
(define-constant ERR-NOT-OWNER (err u112))
(define-constant ERR-INVALID-UPDATE (err u113))
(define-constant MAX-METADATA-LEN u512)
(define-constant MAX-GOALS-LEN u5)
(define-constant MAX-TAGS-LEN u10)

;; NFT Definition (SIP-009 compliant traits can be added if needed, but keeping core for now)
(define-non-fungible-token eco-nft uint)

;; Data Variables
(define-data-var last-nft-id uint u0)
(define-data-var contract-paused bool false)
(define-data-var admin principal CONTRACT-OWNER)

;; Data Maps
(define-map nft-metadata
  { nft-id: uint }
  {
    area-id: uint,
    gps-coordinates: (tuple (lat int) (long int)),
    description: (string-utf8 256),
    image-uri: (string-ascii 256),
    conservation-goals: (list 5 (string-utf8 100)),
    mint-timestamp: uint,
    royalty-percentage: uint, ;; Basis points, e.g., 1000 = 10%
    royalty-recipient: principal
  }
)

(define-map area-to-nft
  { area-id: uint }
  { nft-id: uint }
)

(define-map minters
  { minter: principal }
  { active: bool }
)

(define-map nft-tags
  { nft-id: uint }
  { tags: (list 10 (string-utf8 20)) }
)

(define-map nft-status
  { nft-id: uint }
  {
    status: (string-utf8 20), ;; e.g., "active", "protected", "funded"
    last-updated: uint
  }
)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin))
)

(define-private (is-minter (caller principal))
  (default-to false (get active (map-get? minters { minter: caller })))
)

(define-private (validate-gps (gps (tuple (lat int) (long int))))
  (and
    (>= (get lat gps) -90000000)
    (<= (get lat gps) 90000000)
    (>= (get long gps) -180000000)
    (<= (get long gps) 180000000)
  )
)

(define-private (validate-goals (goals (list 5 (string-utf8 100))))
  (and
    (> (len goals) u0)
    (<= (len goals) MAX-GOALS-LEN)
  )
)

(define-private (validate-metadata (description (string-utf8 256)) (image-uri (string-ascii 256)))
  (and
    (<= (len description) MAX-METADATA-LEN)
    (<= (len image-uri) u256)
  )
)

;; Public Functions

;; Mint a new eco-NFT
(define-public (mint-nft
  (area-id uint)
  (gps (tuple (lat int) (long int)))
  (description (string-utf8 256))
  (image-uri (string-ascii 256))
  (conservation-goals (list 5 (string-utf8 100)))
  (royalty-percentage uint)
  (royalty-recipient principal)
  (recipient principal)
  (tags (list 10 (string-utf8 20))))
  (begin
    (asserts! (not (var-get contract-paused)) ERR-PAUSED)
    (asserts! (is-minter tx-sender) ERR-INVALID-MINTER)
    (asserts! (> area-id u0) ERR-INVALID-AREA-ID)
    (asserts! (is-none (map-get? area-to-nft { area-id: area-id })) ERR-NFT-ALREADY-EXISTS)
    (asserts! (not (is-eq recipient CONTRACT-OWNER)) ERR-INVALID-RECIPIENT)
    (asserts! (validate-gps gps) ERR-INVALID-GPS)
    (asserts! (validate-goals conservation-goals) ERR-INVALID-GOALS)
    (asserts! (validate-metadata description image-uri) ERR-INVALID-METADATA)
    (asserts! (and (>= royalty-percentage u0) (<= royalty-percentage u10000)) ERR-INVALID-ROYALTY)
    (asserts! (<= (len tags) MAX-TAGS-LEN) ERR-INVALID-METADATA)
    (let
      (
        (new-nft-id (+ (var-get last-nft-id) u1))
      )
      (try! (nft-mint? eco-nft new-nft-id recipient))
      (map-set nft-metadata
        { nft-id: new-nft-id }
        {
          area-id: area-id,
          gps-coordinates: gps,
          description: description,
          image-uri: image-uri,
          conservation-goals: conservation-goals,
          mint-timestamp: block-height,
          royalty-percentage: royalty-percentage,
          royalty-recipient: royalty-recipient
        }
      )
      (map-set area-to-nft
        { area-id: area-id }
        { nft-id: new-nft-id }
      )
      (map-set nft-tags
        { nft-id: new-nft-id }
        { tags: tags }
      )
      (map-set nft-status
        { nft-id: new-nft-id }
        {
          status: u"active",
          last-updated: block-height
        }
      )
      (var-set last-nft-id new-nft-id)
      (print { event: "nft-minted", nft-id: new-nft-id, area-id: area-id, minter: tx-sender, recipient: recipient })
      (ok new-nft-id)
    )
  )
)

;; Transfer NFT (standard SIP-009)
(define-public (transfer (nft-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (not (var-get contract-paused)) ERR-PAUSED)
    (asserts! (is-eq tx-sender sender) ERR-UNAUTHORIZED)
    (asserts! (is-some (nft-get-owner? eco-nft nft-id)) ERR-INVALID-AREA-ID) ;; Ensure exists
    (try! (nft-transfer? eco-nft nft-id sender recipient))
    (print { event: "nft-transferred", nft-id: nft-id, from: sender, to: recipient })
    (ok true)
  )
)

;; Update NFT metadata (only owner)
(define-public (update-metadata (nft-id uint) (new-description (string-utf8 256)) (new-image-uri (string-ascii 256)))
  (let
    (
      (owner (unwrap! (nft-get-owner? eco-nft nft-id) ERR-INVALID-AREA-ID))
      (current-metadata (unwrap! (map-get? nft-metadata { nft-id: nft-id }) ERR-INVALID-AREA-ID))
    )
    (asserts! (is-eq tx-sender owner) ERR-NOT-OWNER)
    (asserts! (validate-metadata new-description new-image-uri) ERR-INVALID-METADATA)
    (map-set nft-metadata
      { nft-id: nft-id }
      (merge current-metadata { description: new-description, image-uri: new-image-uri })
    )
    (map-set nft-status
      { nft-id: nft-id }
      (merge (unwrap-panic (map-get? nft-status { nft-id: nft-id })) { last-updated: block-height })
    )
    (print { event: "metadata-updated", nft-id: nft-id, owner: owner })
    (ok true)
  )
)

;; Update conservation goals (only owner)
(define-public (update-goals (nft-id uint) (new-goals (list 5 (string-utf8 100))))
  (let
    (
      (owner (unwrap! (nft-get-owner? eco-nft nft-id) ERR-INVALID-AREA-ID))
      (current-metadata (unwrap! (map-get? nft-metadata { nft-id: nft-id }) ERR-INVALID-AREA-ID))
    )
    (asserts! (is-eq tx-sender owner) ERR-NOT-OWNER)
    (asserts! (validate-goals new-goals) ERR-INVALID-GOALS)
    (map-set nft-metadata
      { nft-id: nft-id }
      (merge current-metadata { conservation-goals: new-goals })
    )
    (map-set nft-status
      { nft-id: nft-id }
      (merge (unwrap-panic (map-get? nft-status { nft-id: nft-id })) { last-updated: block-height })
    )
    (print { event: "goals-updated", nft-id: nft-id, owner: owner })
    (ok true)
  )
)

;; Update status (only owner or minter)
(define-public (update-status (nft-id uint) (new-status (string-utf8 20)))
  (let
    (
      (owner (unwrap! (nft-get-owner? eco-nft nft-id) ERR-INVALID-AREA-ID))
    )
    (asserts! (or (is-eq tx-sender owner) (is-minter tx-sender)) ERR-UNAUTHORIZED)
    (asserts! (<= (len new-status) u20) ERR-INVALID-UPDATE)
    (map-set nft-status
      { nft-id: nft-id }
      {
        status: new-status,
        last-updated: block-height
      }
    )
    (print { event: "status-updated", nft-id: nft-id, status: new-status })
    (ok true)
  )
)

;; Add tags (only owner)
(define-public (add-tags (nft-id uint) (new-tags (list 10 (string-utf8 20))))
  (let
    (
      (owner (unwrap! (nft-get-owner? eco-nft nft-id) ERR-INVALID-AREA-ID))
      (current-tags (get tags (map-get? nft-tags { nft-id: nft-id })))
    )
    (asserts! (is-eq tx-sender owner) ERR-NOT-OWNER)
    (asserts! (<= (+ (len (default-to (list) current-tags)) (len new-tags)) MAX-TAGS-LEN) ERR-INVALID-METADATA)
    (map-set nft-tags
      { nft-id: nft-id }
      { tags: (concat (default-to (list) current-tags) new-tags) }
    )
    (ok true)
  )
)

;; Admin: Set new admin
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (var-set admin new-admin)
    (ok true)
  )
)

;; Admin: Pause contract
(define-public (pause-contract)
  (begin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (var-set contract-paused true)
    (ok true)
  )
)

;; Admin: Unpause contract
(define-public (unpause-contract)
  (begin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (var-set contract-paused false)
    (ok true)
  )
)

;; Admin: Add minter
(define-public (add-minter (new-minter principal))
  (begin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (asserts! (is-none (map-get? minters { minter: new-minter })) ERR-ALREADY-REGISTERED)
    (map-set minters { minter: new-minter } { active: true })
    (ok true)
  )
)

;; Admin: Remove minter
(define-public (remove-minter (minter-to-remove principal))
  (begin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (map-set minters { minter: minter-to-remove } { active: false })
    (ok true)
  )
)

;; Read-Only Functions

(define-read-only (get-last-nft-id)
  (ok (var-get last-nft-id))
)

(define-read-only (get-nft-metadata (nft-id uint))
  (map-get? nft-metadata { nft-id: nft-id })
)

(define-read-only (get-nft-by-area (area-id uint))
  (map-get? area-to-nft { area-id: area-id })
)

(define-read-only (get-nft-owner (nft-id uint))
  (nft-get-owner? eco-nft nft-id)
)

(define-read-only (get-nft-tags (nft-id uint))
  (get tags (map-get? nft-tags { nft-id: nft-id }))
)

(define-read-only (get-nft-status (nft-id uint))
  (map-get? nft-status { nft-id: nft-id })
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-admin)
  (var-get admin)
)

(define-read-only (check-is-minter (account principal))
  (is-minter account)
)