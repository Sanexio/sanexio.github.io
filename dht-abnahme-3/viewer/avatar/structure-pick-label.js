// A selected point stays attached to the model when the camera moves.
export function structurePickLabel({viewport, camera, THREE}) {
  const node = document.createElement('span');
  node.className = 'avatar-label';
  node.dataset.structurePick = '';
  node.style.cssText = 'position:absolute;z-index:5;pointer-events:none';
  node.hidden = true;
  viewport.append(node);
  let point = null;
  return {
    show(name, world) { node.textContent = name; point = world.clone(); node.hidden = false; this.paint(); },
    paint() {
      if (!point) return;
      const p = point.clone().project(camera);
      node.hidden = p.z < -1 || p.z > 1;
      node.style.left = `${Math.max(0, Math.min(viewport.clientWidth - node.offsetWidth, (p.x + 1) * viewport.clientWidth / 2 + 8))}px`;
      node.style.top = `${Math.max(0, Math.min(viewport.clientHeight - node.offsetHeight, (1 - p.y) * viewport.clientHeight / 2))}px`;
    },
    clear() { point = null; node.hidden = true; },
    dispose() { node.remove(); }
  };
}
