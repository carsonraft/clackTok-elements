window.WB = window.WB || {};

// ─── US States Weapon Icon Atlas ────────────────────────────────
// Loads individual pixel-art PNGs from assets/pixel-icons/ and packs
// them into an 8x8 grid atlas (1024x1024, 128x128 per cell).
// Registers as atlas 1 on WB.WeaponSprites.
// Non-square PNGs are scaled to fit within 128x128, centered.
// Florida gator is stitched from 4 quadrant PNGs into one sprite.

WB.StatesIcons = {

    // ─── Sprite key → PNG filename (no extension) ────────────
    // Keys must match what states-pack.js references via drawWeaponSprite / spriteKey
    PNGS: {
        'alabama-rocket':       'alabamaRocket',
        'arkansas-shard':       'arkansasDiamond',
        'california-sword':     'californiaBlade',
        'colorado-boulder':     'coloradoBoulder',
        'connecticut-briefcase':'connecticutBriefcase',
        'delaware-shell':       'delawareShell',
        'georgia-fizz':         'georgiaBottle',
        'hawaii-lava':          'hawaiiLavaRock',
        'idaho-kernel':         'idahoKernel',
        'idaho-popcorn':        'idahoPopcorn',
        'illinois-cutter':      'illinoisPizzaCutter',
        'indiana-tire':         'indianaTire',
        'iowa-stalk':           'iowaCorn',
        'kansas-funnel':        'kansasTornado',
        'kentucky-barrel':      'kentuckyBarrel',
        'maine-claw':           'maineLobster',
        'maryland-claw':        'marylandClaw',
        'massachusetts-hex':    'massachusettsHex',
        'michigan-gear':        'michiganGear',
        'minnesota-stick':      'minnesotaStick',
        'mississippi-paddle':   'mississippiPaddle',
        'missouri-arch':        'missouriArch',
        'montana-antler':       'montanaAntlers',
        'nebraska-horns':       'nebraskaHorns',
        'nevada-slot':          'nevadaSlotLever',
        'newjersey-pill':       'newJerseyPill',
        'newmexico-chile':      'newMexicoChile',
        'newyork-dart':         'newYorkDart',
        'newyork-terrain':      'newYorkSkyscraper',
        'northcarolina-prop':   'northCarolinaPropeller',
        'northdakota-oil':      'northDakotaOilGlob',
        'ohio-football':        'ohioFootball',
        'oklahoma-turbine':     'oklahomaTurbine',
        'oregon-log':           'oregonLog',
        'alaska-harpoon':       'oregonSpear',
        'pennsylvania-bell':    'pennsylvaniaBell',
        'rhodeisland-anchor':   'rhodeIslandAnchor',
        'southcarolina-frond':  'southCarolinaFrond',
        'southcarolina-saber':  'southCarolinaSaber',
        'tennessee-banjo':      'tennesseeBanjo',
        'tennessee-note':       'tennesseeNote',
        'texas-spur':           'texasSpur1',
        'texas-spur-2':         'texasSpur2',
        'vermont-syrup':        'vermontSyrup',
        'virginia-saber':       'virginiaSaber',
        'washington-bean':      'washingtonBean',
        'westvirginia-pickaxe': 'westVirginiaPickaxe',
        'wisconsin-cheese':     'wisconsinCheese',
        'wyoming-geyser':       'wyomingGeyser',
        // South Dakota president busts (hazard sprites)
        'southdakota-washington':'southDakotaWashington',
        'southdakota-jefferson': 'southDakotaJefferson',
        'southdakota-roosevelt': 'southDakotaRoosevelt',
        'southdakota-lincoln':   'southDakotaLincoln',
        // New weapon sprites (v79)
        'nh-boulder':            'newHampshireBoulder',
        'vt-broken-bottle':      'vermontBrokenBottle',
        'la-mask1':              'louisianaMask1',
        'la-mask2':              'louisianaMask2',
        'la-mask3':              'louisianaMask3',
        'la-mask4':              'louisianaMask4',
        'az-phoenix':            'arizonaPhoenix',
        'la-bead-purple':        'louisianaBeadPurple',
        'la-bead-gold':          'louisianaBeadGold',
        'la-bead-green':         'louisianaBeadGreen',
        'utah-crystal':          'southCarolinaSaber',
    },

    // ─── Stitched sprites (multiple PNGs → one sprite) ───────
    // Florida gator: 4 quadrant PNGs form a 2×2 grid = 256×256 gator
    STITCHED: {
        'florida-jaw': {
            layout: [2, 2],  // cols, rows
            pieces: [
                'floridaGator1', 'floridaGator2',   // top-left, top-right
                'floridaGator3', 'floridaGator4',    // bottom-left, bottom-right
            ]
        }
    },

    // ─── Weapon type → primary sprite key ─────────────────────
    WEAPON_ICON: {
        'alaska':         'alaska-harpoon',
        'alabama':        'alabama-rocket',
        'arkansas':       'arkansas-shard',
        'california':     'california-sword',
        'colorado':       'colorado-boulder',
        'connecticut':    'connecticut-briefcase',
        'delaware':       'delaware-shell',
        'florida':        'florida-jaw',
        'georgia':        'georgia-fizz',
        'hawaii':         'hawaii-lava',
        'idaho':          'idaho-kernel',
        'illinois':       'illinois-cutter',
        'indiana':        'indiana-tire',
        'iowa':           'iowa-stalk',
        'kansas':         'kansas-funnel',
        'kentucky':       'kentucky-barrel',
        'maine':          'maine-claw',
        'maryland':       'maryland-claw',
        'massachusetts':  'massachusetts-hex',
        'michigan':       'michigan-gear',
        'minnesota':      'minnesota-stick',
        'mississippi':    'mississippi-paddle',
        'missouri':       'missouri-arch',
        'montana':        'montana-antler',
        'nebraska':       'nebraska-horns',
        'nevada':         'nevada-slot',
        'new-jersey':     'newjersey-pill',
        'new-mexico':     'newmexico-chile',
        'new-york':       'newyork-dart',
        'north-carolina': 'northcarolina-prop',
        'north-dakota':   'northdakota-oil',
        'ohio':           'ohio-football',
        'oklahoma':       'oklahoma-turbine',
        'oregon':         'oregon-log',
        'pennsylvania':   'pennsylvania-bell',
        'rhode-island':   'rhodeisland-anchor',
        'south-carolina': 'southcarolina-frond',
        'tennessee':      'tennessee-banjo',
        'texas':          'texas-spur',
        'utah':           'utah-crystal',
        'vermont':        'vt-broken-bottle',
        'virginia':       'virginia-saber',
        'washington':     'washington-bean',
        'west-virginia':  'westvirginia-pickaxe',
        'wisconsin':      'wisconsin-cheese',
        'wyoming':        'wyoming-geyser',
        'new-hampshire':  'nh-boulder',
        'louisiana':      'la-mask1',
        'arizona':        'az-phoenix',
    },

    // ─── Secondary sprites for dual-icon states ─────────────
    PROJECTILE_ICON: {
        'minnesota':  'minnesota-puck',
        'new-york':       'newyork-terrain',
        'new-hampshire':  'nh-boulder',
        'arizona':        'az-phoenix',
    },

    // ─── Atlas config ───────────────────────────────────────
    ATLAS_SIZE: 1024,
    CELL_SIZE: 128,
    GRID_DIM: 8,

    // ─── Atlas Builder ──────────────────────────────────────

    init() {
        if (!WB.WeaponSprites || !WB.WeaponSprites._program) {
            console.warn('[StatesIcons] WeaponSprites not ready, retrying in 500ms');
            setTimeout(() => this.init(), 500);
            return;
        }

        // Collect all sprite keys: normal PNGs + stitched composites
        var normalKeys = Object.keys(this.PNGS);
        var stitchedKeys = Object.keys(this.STITCHED);
        var allKeys = normalKeys.concat(stitchedKeys);

        // Build grid positions: pack sequentially into 8x8
        this.GRID = {};
        for (var i = 0; i < allKeys.length; i++) {
            this.GRID[allKeys[i]] = [i % this.GRID_DIM, Math.floor(i / this.GRID_DIM)];
        }

        var canvas = document.createElement('canvas');
        canvas.width = this.ATLAS_SIZE;
        canvas.height = this.ATLAS_SIZE;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, this.ATLAS_SIZE, this.ATLAS_SIZE);

        var self = this;
        var totalJobs = normalKeys.length + stitchedKeys.length;
        var doneJobs = 0;

        function checkDone() {
            doneJobs++;
            if (doneJobs === totalJobs) self._finalize(canvas);
        }

        // ── Load normal (single-PNG) sprites ────────────────
        normalKeys.forEach(function(key) {
            var filename = self.PNGS[key];
            var pos = self.GRID[key];
            var img = new Image();

            img.onload = function() {
                var cellX = pos[0] * self.CELL_SIZE;
                var cellY = pos[1] * self.CELL_SIZE;
                // Scale to fit within 128x128, preserving aspect ratio, centered
                var srcW = img.naturalWidth;
                var srcH = img.naturalHeight;
                var scale = Math.min(self.CELL_SIZE / srcW, self.CELL_SIZE / srcH);
                var dstW = Math.round(srcW * scale);
                var dstH = Math.round(srcH * scale);
                var offX = Math.round((self.CELL_SIZE - dstW) / 2);
                var offY = Math.round((self.CELL_SIZE - dstH) / 2);
                ctx.drawImage(img, cellX + offX, cellY + offY, dstW, dstH);
                checkDone();
            };
            img.onerror = function() {
                console.warn('[StatesIcons] Failed to load: ' + filename + '.png');
                checkDone();
            };
            img.src = 'assets/pixel-icons/' + filename + '.png';
        });

        // ── Load stitched (multi-PNG) sprites ───────────────
        stitchedKeys.forEach(function(key) {
            var spec = self.STITCHED[key];
            var pos = self.GRID[key];
            var cols = spec.layout[0];
            var rows = spec.layout[1];
            var pieces = spec.pieces;
            var piecesLoaded = 0;
            var pieceImages = new Array(pieces.length);

            pieces.forEach(function(pieceName, idx) {
                var img = new Image();
                img.onload = function() {
                    pieceImages[idx] = img;
                    piecesLoaded++;
                    if (piecesLoaded === pieces.length) {
                        // All pieces loaded — stitch onto a temp canvas, then draw scaled
                        var pieceW = pieceImages[0].naturalWidth;
                        var pieceH = pieceImages[0].naturalHeight;
                        var fullW = cols * pieceW;
                        var fullH = rows * pieceH;
                        var tmpCanvas = document.createElement('canvas');
                        tmpCanvas.width = fullW;
                        tmpCanvas.height = fullH;
                        var tmpCtx = tmpCanvas.getContext('2d');
                        for (var p = 0; p < pieces.length; p++) {
                            var pc = p % cols;
                            var pr = Math.floor(p / cols);
                            if (pieceImages[p]) {
                                tmpCtx.drawImage(pieceImages[p], pc * pieceW, pr * pieceH);
                            }
                        }
                        // Scale stitched result into the 128x128 cell
                        var cellX = pos[0] * self.CELL_SIZE;
                        var cellY = pos[1] * self.CELL_SIZE;
                        var scale = Math.min(self.CELL_SIZE / fullW, self.CELL_SIZE / fullH);
                        var dstW = Math.round(fullW * scale);
                        var dstH = Math.round(fullH * scale);
                        var offX = Math.round((self.CELL_SIZE - dstW) / 2);
                        var offY = Math.round((self.CELL_SIZE - dstH) / 2);
                        ctx.drawImage(tmpCanvas, cellX + offX, cellY + offY, dstW, dstH);
                        checkDone();
                    }
                };
                img.onerror = function() {
                    pieceImages[idx] = null;
                    piecesLoaded++;
                    if (piecesLoaded === pieces.length) checkDone();
                };
                img.src = 'assets/pixel-icons/' + pieceName + '.png';
            });
        });
    },

    _finalize(canvas) {
        WB.WeaponSprites.registerAtlas(1, canvas, this.GRID, this.GRID_DIM);
        console.log('[StatesIcons] PNG atlas built (' +
            Object.keys(this.GRID).length + ' sprites, ' +
            this.ATLAS_SIZE + 'x' + this.ATLAS_SIZE + ')');
    },
};
