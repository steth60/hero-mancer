# TODO

- FIX: Selecting custom compendiums and then deleting them should fall back to default 'SRD' and/or scanning for all
  compendiums.

- FIX: Choosing new custom compendiums should not throw error on missing compendiums, should be a warning and/or
  suppress based on log level.

- ADD: Roll 'all'/ Roll 'sequential' option/button to allow rolling stats faster.

## Equipment Progress

### Barbarian

- Working
- CHECK: '2 Handaxes' actually respects quantity?

### Bard

- Working

### Cleric

- How do we check a proficiency on an uncompleted character sheet? (Warhammer, Chainmail proficiency)
- Render Light CB & CB Bolts as 1 item, disable dropdown unless CB/CB Bolts is unchecked since it's an OR block.

### Druid

- type: armor, key: shield not pulling dropdown options.
- simple melee weapon not pulling either (key: simpleM).

### Fighter

- Chainmail or 3x items should be A or B, currently chainmail is alone in a dropdown and 3 checkbox for the 3x items.
- any martialM + any shield OR 2x martialM requires very specific handling.
- Same Light CB/CB Bolt issue as Cleric.

### Monk

- Working

### Paladin

- Same issue as fighter but the dropdown is completely blank - so this handling is unstable at best.

### Ranger

- 2x shortsword or 2x simpleM (make sure the dropdown prefixes with count if count >1?)
- Combine longbow, quiver, 20 arrows, or at least ammo + weapon?

### Rogue

- Shortbow/quiver/20arrow OR shortsword dropdown is pointless. Needs A or B logic handling.

### Sorcerer

- Again, dropdowns should be disabled if checkbox is enabled (default: true) to enforce OR logic.
- Pouch or ANY arcane focus - how is this handled for arcane focus'?

### Warlock

- Again, dropdowns should be disabled if checkbox is enabled (default: true) to enforce OR logic.
- Pouch or ANY arcane focus - how is this handled for arcane focus'?

# Wizard

- Pouch or ANY arcane focus - how is this handled for arcane focus'?
