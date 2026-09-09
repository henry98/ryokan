# Komorebi — A quiet departure

A small first-person browser game in a Japanese ryokan. Walk through the timber corridor, tatami rooms, hinoki bath and forest balcony. Find the tea cup, bath towel and room key, then finish your stay at the balcony marker. The bathroom contains one backless wooden stool and no chairs.

This folder is the complete static website. It contains HTML, CSS, JavaScript, locally bundled Three.js 0.180.0 (MIT), and a glTF model exported from the project's editable Blender source. No backend, API key, npm install, build step, CDN, or Unreal installation is needed to play. Serve over HTTP(S), rather than opening `index.html` as a `file://` URL. The complete folder is approximately 16 MB.

## Publish to GitHub Pages

1. Create a GitHub repository and put **the contents of this folder** at its root. `index.html`, `game.js`, `assets/`, and `vendor/` must sit alongside one another. Do not upload the native Unreal project, the original movie, or the Mac app.
2. In the repository, open **Settings → Pages → Build and deployment**. Select **Deploy from a branch**, branch **main**, folder **/ (root)**, and Save.
3. Wait for the Pages deployment to complete. Your site will be available at `https://YOUR-USER.github.io/YOUR-REPOSITORY/`. Every asset URL is relative, so project subpaths work.

Alternatively, choose **GitHub Actions** as the Pages source. The included `.github/workflows/pages.yml` deploys on pushes to `main`, or manually from the Actions tab. If your default branch has another name, update the workflow. Reference: [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

For Git users, run these commands **inside this folder** after replacing the repository URL:

```sh
git init -b main
git add .
git commit -m "Add Komorebi browser game"
git remote add origin https://github.com/YOUR-USER/YOUR-REPOSITORY.git
git push -u origin main
```

Deployment repository: [henry98/ryokan](https://github.com/henry98/ryokan). The intended Pages URL is `https://henry98.github.io/ryokan/`.

## Preview locally

With Python 3 installed, run inside this folder:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080`. Stop the server with Ctrl+C.

## Controls

| Control | Action |
| --- | --- |
| WASD | Walk |
| Mouse | Look; click and drag if mouse capture is unavailable |
| Shift | Sprint |
| Space | Jump |
| E | Collect the object you are looking at; finish at the balcony marker |
| Esc / Pause | Pause and release the mouse |
| R | Restart from the corridor |
| M | Show/hide the floor plan |
| Arrow keys | Forward/backward and turn |
| Page Up / Page Down | Look up/down without a mouse |

The pause menu offers Low, Balanced and High quality. A WebGL 2 capable browser and hardware acceleration are required. There is no saved progress or audio.

### Phone and tablet controls

The interface detects touch devices automatically and works in portrait or landscape. Refresh the page after an update to load the latest controls.

- Drag the **left thumb stick** to walk. Small movements walk slowly; move it farther to walk at full speed.
- Drag anywhere on the **scene** with your other thumb to look. Both thumbs work at the same time.
- Tap **Run** to toggle sprint, **Jump** to jump, and **Collect** when looking at a nearby golden marker. The button changes to **Leave** at the exit after all three items are collected.
- Tap **Bag** for the item hints or **Map** for the floor plan. Tap the same button again to close it.
- Tap **Pause** to continue later, start over, or change graphics quality.

Controls avoid phone notches and the home indicator. Rotation, paused/background state, and cancelled touches clear movement to prevent stuck controls. Touch devices start on **Low** graphics (no realtime shadows, capped render resolution); raise quality from Pause if your phone runs smoothly.

Chrome mobile emulation verifies real multi-touch event input, portrait/landscape layouts down to 320 px width, simulated safe areas, pickups, jumping, ending and restart. Desktop Chrome was also tested. Physical phone performance and actual iOS Safari/Android hardware remain unverified.

## Editing

- `index.html` and `style.css`: interface, copy and layout.
- `game.js`: lighting, camera, input, objectives and interaction.
- `physics.js`: player collision and movement.
- `assets/retreat.glb`: optimized render model, including textures and named collectible objects.
- `assets/collision.json`: collision bounds exported from the original scene.
- `vendor/`: pinned Three.js library, glTF loader and MIT license.

The original workspace retains `assets/blender/Komorebi_Retreat.blend` and `scripts/export_web.py`. Re-export with Blender in background mode after scene edits; the exporter writes both GLB and collision data without changing the saved `.blend`. It welds and simplifies the forest and pebbles, reduces bevel segments and embeds JPEG textures. Lighting and gameplay are recreated for WebGL; this is a browser adaptation, not an Unreal HTML build.

Developer tests can opt into `?test=1` to expose a small deterministic test API. Normal play does not expose it. The original workspace includes `scripts/test_web.cjs` for Playwright verification and screenshots.
