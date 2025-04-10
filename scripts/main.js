import { findEncounterJournalByType } from "./encounterLookup.js";

// scripts/main.js

Hooks.once("init", () => {
    (async () => {
        const response = await fetch("modules/alarm-encounter-engine/data/encounter-type-table.json");
        encounterTypeTable = await response.json();
        console.log("Alarm Encounter Engine | Encounter type table loaded.");
      });

    game.settings.register("alarm-encounter-engine", "tableSourceType", {
      name: "Encounter Table Source Type",
      hint: "Choose whether to pull encounters from a compendium or journal folder.",
      scope: "world",
      config: true,
      default: "compendium",
      type: String,
      choices: {
        "compendium": "Compendium",
        "journal": "Journal Folder"
      }
    });
  
    game.settings.register("alarm-encounter-engine", "tableSourceKey", {
      name: "Encounter Source Key",
      hint: "Enter the compendium key (e.g., encounters.menador) or journal folder name.",
      scope: "world",
      config: true,
      default: "encounters.menador",
      type: String
    });

    game.settings.register("alarm-encounter-engine", "customEncounterTable", {
        name: "Master Encounter Table",
        hint: "A 3d4-based table that maps row/column to an encounter type",
        scope: "world",
        config: false, // we'll create a custom menu for this
        type: Object,
        default: {}
      });
      
      game.settings.registerMenu("alarm-encounter-engine", "editEncounterTable", {
        name: "Edit Encounter Table",
        label: "Open Table Editor",
        hint: "Modify how each 3d4 result maps to encounter types",
        icon: "fas fa-table",
        type: EncounterTableEditor, // you'll create this class
        restricted: true
      });      
  });
  

Hooks.once('ready', () => {
    console.log("Alarm Encounter Engine | Ready");
    game.alarmEncounter = {
      openDialog: () => new AlarmEncounterDialog().render(true)
    };
  });
  
  class AlarmEncounterDialog extends Dialog {
    constructor(options) {
      super(options);
    }
  
    static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
        title: "Roll Travel Encounter",
        id: "alarm-encounter-dialog",
        template: "modules/alarm-encounter-engine/templates/encounter-dialog.html",
        classes: ["alarm-encounter-dialog"],
        width: 400,
      });
    }
  
    activateListeners(html) {
      super.activateListeners(html);
  
      html.find('#roll-method').change(ev => {
        const val = ev.target.value;
        html.find("#manual-dice-inputs").toggle(val === "manual");
      });

      html.find(".reset").click(ev => {
        const defaultTable = this.getDefaultTable();
      
        for (let row = 3; row <= 16; row++) {
          for (let col = 0; col < 4; col++) {
            html.find(`input[name="${row}-${col}"]`).val(defaultTable[row][col]);
          }
        }
      
        ui.notifications.info("Encounter table reset to default.");
      });
      
  
      html.find('form').on('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
      
        // --- Alarm Level calculation ---
        const terrainMod = parseInt(data["terrain"]);
        const partyMod = parseInt(data["party-size"]);
        const manualMod = parseInt(data["manual-alarm"]) || 0;
      
        let actionMod = 0;
        if (data["hide-tracks"]) actionMod -= 1;
        if (data["slow-travel"]) actionMod -= 1;
      
        const alarmLevel = terrainMod + partyMod + actionMod + manualMod;
      
        // --- 3d4 Roll ---
        let d4_1, d4_2, d4_3;
      
        if (data["roll-method"] === "manual") {
          d4_1 = parseInt(data["d4_1"]);
          d4_2 = parseInt(data["d4_2"]);
          d4_3 = parseInt(data["d4_3"]);
        } else {
          d4_1 = Math.ceil(Math.random() * 4);
          d4_2 = Math.ceil(Math.random() * 4);
          d4_3 = Math.ceil(Math.random() * 4);
        }
      
        const baseSum = d4_1 + d4_2 + d4_3;
        const finalRow = baseSum + alarmLevel;
        const finalCol = d4_1;

        // Pull encounter type from the custom encounter table
        const table = game.settings.get("alarm-encounter-engine", "customEncounterTable");
        const encounterType = table?.[finalRow]?.[finalCol - 1] || "Uneventful";


        const journalEntry = await findEncounterJournalByType(encounterType);

        if (!journalEntry) {
          ui.notifications.warn(`No journal entry found for R${finalRow}C${finalCol}`);
          return;
        }
      
        const content = journalEntry.content;
      
        // Parse Location
        const locationMatch = content.match(/\*\*Location:\*\* (.*)/);
        const location = locationMatch ? locationMatch[1].trim() : "Unknown";
      
        // Parse Actors
        const actorMatches = [...content.matchAll(/@UUID\[([^\]]+)](?:\{([^}]+)\})?(?:\s*x\s*(\d+))?/gi)];
        const actorData = actorMatches.map(match => ({
          uuid: match[1],
          name: match[2] || "Unknown Actor",
          quantity: parseInt(match[3]) || 1
        }));
      
        // Parse Description
        const description = content.split("**Description:**")[1]?.trim() || "No description available.";
      
        // Build Actor Display
        const actorOutput = actorData.map(actor => {
          return `@UUID[${actor.uuid}]{${actor.name}} x ${actor.quantity}`;
        }).join("<br>");
      
        // Send to chat
        const msg = `
        <h2>${journalEntry.name}</h2>
        <p><strong>Encounter Type:</strong> ${encounterType}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Actors:</strong><br>${actorOutput}</p>
        <hr>
        ${description}
        `;

        new Dialog({
            title: "Preview Encounter Result",
            content: `<div class="encounter-preview">${msg}</div>`,
            buttons: {
              send: {
                icon: '<i class="fas fa-paper-plane"></i>',
                label: "Send to Chat",
                callback: () => {
                  ChatMessage.create({
                    user: game.user.id,
                    content: msg,
                    whisper: [game.user.id]
                  });
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
              }
            },
            default: "send"
          }).render(true);

        this.close(); // Close dialog on submit
      });

      //export
      html.find(".export").click(() => {
        const table = game.settings.get("alarm-encounter-engine", "customEncounterTable");
        const json = JSON.stringify(table, null, 2);
        navigator.clipboard.writeText(json);
        ui.notifications.info("Encounter table copied to clipboard.");
      });

      //import
      html.find(".import").click(() => {
        const raw = html.find("#import-json").val().trim();
      
        try {
          const parsed = JSON.parse(raw);
      
          // Validate minimal shape
          for (let row = 3; row <= 16; row++) {
            if (!parsed[row] || !Array.isArray(parsed[row]) || parsed[row].length !== 4) {
              throw new Error(`Row ${row} is missing or malformed.`);
            }
          }
      
          game.settings.set("alarm-encounter-engine", "customEncounterTable", parsed);
          ui.notifications.info("Encounter table imported.");
          this.render(); // Refresh UI
        } catch (err) {
          console.error(err);
          ui.notifications.error("Failed to import table. Make sure the JSON is valid.");
        }
      });
    }
  }
  