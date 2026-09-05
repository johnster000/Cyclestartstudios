/* Save game to localStorage. One slot plus settings. */
(function () {
  const KEY = 'pocketDungeons.save.v1', SET = 'pocketDungeons.settings';
  const Save = {
    exists() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
    write(obj) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ version: 1, savedAt: Date.now() }, obj))); return true; } catch (e) { console.warn('save failed', e); return false; } },
    read() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
    settings() { try { return JSON.parse(localStorage.getItem(SET) || '{}'); } catch (e) { return {}; } },
    setSetting(k, v) { const s = Save.settings(); s[k] = v; try { localStorage.setItem(SET, JSON.stringify(s)); } catch (e) {} },
  };
  window.Save = Save;
})();
