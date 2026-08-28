function key(kind, slug) {
  return `bagullm.learn.player.${slug}.${kind}`;
}

export function loadPlayerOpen(kind, slug) {
  try {
    const v = sessionStorage.getItem(key(kind, slug));
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function savePlayerOpen(kind, slug, open) {
  try {
    sessionStorage.setItem(key(kind, slug), open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function trashScopeKey(slug) {
  return `bagullm.learn.trash.showAll.${slug}`;
}

export function loadTrashShowAll(slug) {
  try {
    return sessionStorage.getItem(trashScopeKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function saveTrashShowAll(slug, showAll) {
  try {
    sessionStorage.setItem(trashScopeKey(slug), showAll ? "1" : "0");
  } catch {
    /* ignore */
  }
}
