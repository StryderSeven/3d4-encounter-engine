export class EncounterTableEditor extends FormApplication {
    constructor(...args) {
      super(...args);
    }

    getDefaultTable() {
        const table = {};
        for (let row = 3; row <= 16; row++) {
          table[row] = ["Uneventful", "Uneventful", "Uneventful", "Uneventful"];
        }
        return table;
      }

      
    static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
        id: "encounter-table-editor",
        title: "Encounter Table Editor",
        template: "modules/alarm-encounter-engine/templates/encounter-table-editor.html",
        width: 700,
        height: "auto",
        resizable: true,
        closeOnSubmit: false
      });
    }
  
    async getData() {
        let table = game.settings.get("alarm-encounter-engine", "customEncounterTable");
      
        if (!Object.keys(table).length) {
          table = this.getDefaultTable();
        }
      
        return {
          table
        };
      }      
  
      async _updateObject(event, formData) {
        const updated = {};
      
        for (let [key, value] of Object.entries(formData)) {
          const [row, col] = key.split("-");
          if (!updated[row]) updated[row] = [];
      
          const trimmed = value.trim();
          if (!trimmed) {
            ui.notifications.error(`Empty encounter type at R${row}C${col}. Please fill all cells.`);
            return;
          }
      
          updated[row][parseInt(col)] = trimmed;
        }
      
        await game.settings.set("alarm-encounter-engine", "customEncounterTable", updated);
        ui.notifications.info("Encounter table updated.");
      }
      
  }
  