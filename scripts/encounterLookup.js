// scripts/encounterLookup.js

export async function findEncounterJournalByType(encounterType) {
    const sourceType = game.settings.get("alarm-encounter-engine", "tableSourceType");
    const sourceKey = game.settings.get("alarm-encounter-engine", "tableSourceKey");
  
    let candidates = [];
  
    // Search world journals
    if (sourceType === "journal") {
      const folder = game.folders.getName(sourceKey);
      if (!folder || folder.type !== "JournalEntry") return null;
  
      candidates = folder.contents.filter(entry =>
        entry.name.toLowerCase().includes(encounterType.toLowerCase()) ||
        entry.text?.content?.includes(`**Type:** ${encounterType}`)
      );
    }
  
    // Search compendium journals
    if (sourceType === "compendium") {
      const pack = game.packs.get(sourceKey);
      if (!pack || pack.documentName !== "JournalEntry") return null;
  
      await pack.getIndex();
      const matches = pack.index.filter(e =>
        e.name.toLowerCase().includes(encounterType.toLowerCase())
      );
  
      for (const entryData of matches) {
        const entry = await pack.getDocument(entryData._id);
        const content = entry.text?.content || "";
  
        if (content.includes(`**Type:** ${encounterType}`)) {
          candidates.push(entry);
        }
      }
    }
  
    // Randomly pick one matching entry
    if (candidates.length === 0) {
      ui.notifications.warn(`No journal entries found for type: ${encounterType}`);
      return null;
    }
  
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen;
  }
  
  