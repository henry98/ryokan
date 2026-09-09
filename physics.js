// World units are meters. Player footprint is a circle. A modest jump stays
// below the suite's overhead beams; furniture and perimeter footprints remain
// solid while airborne. Source bounds come from scripts/export_web.py.
export class Walker {
  constructor(boxes) {
    this.boxes = boxes; this.radius = .22; this.x = 0; this.z = 1.2;
    this.resetJump();
  }
  resetJump() { this.height = 0; this.verticalSpeed = 0; this.grounded = true; }
  jump() {
    if (!this.grounded) return;
    this.verticalSpeed = 3.5;
    this.grounded = false;
  }
  updateJump(dt) {
    if (this.grounded) return;
    const gravity = 12;
    this.height += this.verticalSpeed * dt - .5 * gravity * dt * dt;
    this.verticalSpeed -= gravity * dt;
    if (this.height <= 0) this.resetJump();
  }
  blocked(x, z) {
    return this.boxes.some(b => {
      const dx = x - Math.max(b.min[0], Math.min(x, b.max[0]));
      const dz = z - Math.max(b.min[2], Math.min(z, b.max[2]));
      return dx * dx + dz * dz < this.radius * this.radius;
    });
  }
  move(dx, dz) {
    // Small substeps prevent tunneling through shoji and rails after a slow frame.
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .06));
    for (let i = 0; i < n; i++) {
      if (!this.blocked(this.x + dx / n, this.z)) this.x += dx / n;
      if (!this.blocked(this.x, this.z + dz / n)) this.z += dz / n;
    }
  }
}
