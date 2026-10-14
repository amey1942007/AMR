/** Static VSM shadows are baked once; anything that moves a caster (wall rise/cutaway, props arriving) marks dirty. */
let dirty = true;
export const markShadowDirty = () => { dirty = true; };
export const takeShadowDirty = () => { const d = dirty; dirty = false; return d; };
