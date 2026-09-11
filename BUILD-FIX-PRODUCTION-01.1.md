# Production Build 01.1 — TypeScript Build Fix

Fixed `TS1294` in `src/game/systems/FluidSystem.ts` when `erasableSyntaxOnly` is enabled.

The constructor parameter property:

```ts
constructor(private readonly scene: Phaser.Scene) {}
```

was replaced with an explicit class field and assignment:

```ts
private readonly scene: Phaser.Scene

constructor(scene: Phaser.Scene) {
  this.scene = scene
}
```

No Sanctuary visuals, fluid animation behavior, productivity features, or stored data were changed.
