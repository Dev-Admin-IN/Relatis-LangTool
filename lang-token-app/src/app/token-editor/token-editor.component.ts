import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-token-editor',
  templateUrl: './token-editor.component.html',
  styleUrls: ['./token-editor.component.css']
})
export class TokenEditorComponent implements OnInit {
  files: string[] = [];
  selectedFile: string = '';
  // flattened tokens for the target language
  tokens: { [k: string]: string } = {};
  // flattened english reference
  englishTokens: { [k: string]: string } = {};
  lang: string = '';
  missingTokens: string[] = [];
  showOnlyMissing = false;
  // cached groups to avoid recomputing on every change-detection cycle
  tokenGroups: { prefix: string, tokens: string[], picture?: string }[] = [];
  // simple versioning to avoid recomputing groups repeatedly when nothing changed
  private tokensVersion = 0;
  private lastComputedVersion = -1;

  tokenPictures: { [prefix: string]: string } = {};
  lastError: string = '';

  // Local storage keys used by the plain HTML tool - keep compatibility
  private ENGLISH_KEY = 'LangExpert_English';
  private LANG_KEY_PREFIX = 'LangExpert_Lang_';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadFiles();
    // Try to auto-load en.json from server first, then fallback to localStorage
    this.http.get('http://localhost:3000/file/en.json').subscribe(
      (data: any) => {
        this.englishTokens = this.flatten(data);
        this.detectMissing();
        // mark english as loaded for UI
        this.selectedFile = 'en.json';
        this.lang = 'en';
        console.log('Loaded en.json from server, tokens:', Object.keys(this.englishTokens).length);
  },
      () => {
        const saved = localStorage.getItem(this.ENGLISH_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            this.englishTokens = this.flatten(parsed);
            this.detectMissing();
            this.selectedFile = 'en.json';
            this.lang = 'en';
            console.log('Loaded en.json from localStorage, tokens:', Object.keys(this.englishTokens).length);
          } catch (e) {
            console.warn('Failed to parse saved english file from localStorage', e);
            this.lastError = 'Failed to parse saved english file from localStorage';
          }
        }
      }
    );
  }

  loadFiles() {
    // Attempt to list files from server; ignore errors
    this.http.get<string[]>('http://localhost:3000/files').subscribe(
      files => this.files = files,
      () => { /* ignore server listing errors */ this.lastError = 'Could not fetch file list from server (server may be down)'; }
    );
    console.log('Requested file list from server');
  }

  loadFile(name: string) {
    this.selectedFile = name;
    this.lang = name.replace(/\.json$/i, '');
    console.log('Loading file from server:', name);
    this.http.get(`http://localhost:3000/file/${name}`).subscribe(
      (data: any) => {
        const flat = this.flatten(data);
        if (name.toLowerCase() === 'en.json') {
          this.englishTokens = flat;
          // also save to localStorage for offline use
          try { localStorage.setItem(this.ENGLISH_KEY, JSON.stringify(data)); } catch {}
        } else {
          this.tokens = flat;
          try { localStorage.setItem(this.LANG_KEY_PREFIX + this.lang, JSON.stringify(this.unflattenToObject(this.tokens))); } catch {}
        }
        this.detectMissing();
      },
      err => {
        const msg = 'Failed to load file ' + name + ': ' + (err.message || err.statusText || err.status);
        alert(msg);
        console.error('loadFile error', err);
        this.lastError = msg;
      }
    );
  }

  uploadFile(event: any) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file, file.name);
    this.http.post('http://localhost:3000/upload', form).subscribe(
      () => this.loadFiles(),
      err => alert('Upload failed: ' + (err.message || err.statusText || err.status))
    );
  }

  // Allow loading English JSON directly from local disk (bypass server)
  loadLocalEnglish(event: any) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const parsed = JSON.parse(e.target.result);
        this.englishTokens = this.flatten(parsed);
        try { localStorage.setItem(this.ENGLISH_KEY, JSON.stringify(parsed)); } catch {}
        this.detectMissing();
        this.selectedFile = 'en.json';
        this.lang = 'en';
        console.log('Loaded English from local file, tokens:', Object.keys(this.englishTokens).length);
      } catch (err) {
        alert('Invalid JSON file');
        this.lastError = 'Invalid English JSON file';
      }
    };
    reader.readAsText(file);
  }

  loadLocalLang(event: any) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const parsed = JSON.parse(e.target.result);
  this.tokens = this.flatten(parsed);
  this.selectedFile = file.name;
  this.lang = file.name.replace(/\.json$/i, '');
  console.log('Loaded target language from local file', this.lang, 'tokens:', Object.keys(this.tokens).length);
        try { localStorage.setItem(this.LANG_KEY_PREFIX + this.lang, JSON.stringify(parsed)); } catch {}
        this.detectMissing();
      } catch (err) {
        alert('Invalid JSON file');
        this.lastError = 'Invalid target language JSON file';
      }
    };
    reader.readAsText(file);
  }

  saveFile() {
    if (!this.selectedFile) {
      alert('No file selected to save');
      return;
    }
    const payload = this.unflattenToObject(this.tokens);
    this.http.post(`http://localhost:3000/save/${this.selectedFile}`, payload).subscribe(
      () => alert('Saved!'),
      err => {
        console.error('Save failed, falling back to download', err);
        const msg = 'Save failed to server, will download file to disk instead';
        alert(msg);
        this.lastError = msg + ': ' + (err.message || err.statusText || err.status);
        // fallback: trigger download of JSON
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.selectedFile || (this.lang + '.json');
        a.click();
      }
    );
  }

  // Try loading english from Angular assets (src/assets/i18n/en.json)
  loadAssetEnglish() {
    this.http.get('/assets/i18n/en.json').subscribe(
      (data: any) => {
        this.englishTokens = this.flatten(data);
        this.detectMissing();
        this.selectedFile = 'en.json';
        this.lang = 'en';
        console.log('Loaded en.json from assets, tokens:', Object.keys(this.englishTokens).length);
        this.computeGroups();
      }, err => {
        console.error('Failed to load en.json from assets', err);
        this.lastError = 'Failed to load en.json from assets: ' + (err.message || err.statusText || err.status);
      }
    );
  }

  isMissing(token: string) {
    return this.missingTokens && this.missingTokens.indexOf(token) !== -1;
  }

  // Recreate missing tokens list: tokens present in englishTokens but missing or empty in tokens
  detectMissing() {
    this.missingTokens = Object.keys(this.englishTokens || {}).filter(k => {
      const val = this.tokens[k];
      return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    });
    // mark data version changed and recompute groups once
    this.tokensVersion++;
    this.computeGroups();
  }

  get englishCount(): number {
    return Object.keys(this.englishTokens || {}).length;
  }

  getTokensToShow(): string[] {
    if (this.showOnlyMissing) return this.missingTokens;
    // show english tokens union translation tokens
    const keys = new Set<string>(Object.keys(this.englishTokens || {}));
    Object.keys(this.tokens || {}).forEach(k => keys.add(k));
    return Array.from(keys).sort();
  }

  getTokenGroups(): { prefix: string, tokens: string[], picture?: string }[] {
    // kept for compatibility but not used by template; prefer tokenGroups cache
    return this.tokenGroups;
  }

  // Build the tokenGroups cache from current tokens/englishTokens and showOnlyMissing
  computeGroups() {
    // Only recompute when version changed
    if (this.lastComputedVersion === this.tokensVersion) return;
    this.lastComputedVersion = this.tokensVersion;
    const tokens = this.getTokensToShow();
    const map: { [p: string]: string[] } = {};
    tokens.forEach(t => {
      const prefix = t.split('.')[0] || 'root';
      if (!map[prefix]) map[prefix] = [];
      map[prefix].push(t);
    });
    this.tokenGroups = Object.keys(map).sort().map(p => ({ prefix: p, tokens: map[p], picture: this.tokenPictures[p] }));
  }

  onShowOnlyMissingChange(v: boolean) {
    this.showOnlyMissing = !!v;
    this.computeGroups();
  }

  attachPicture(event: any, prefix: string) {
    const f = event.target.files && event.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e: any) => this.tokenPictures[prefix] = e.target.result;
    r.readAsDataURL(f);
  }

  // Flatten nested object -> { 'a.b.c': value }
  flatten(obj: any, prefix = ''): { [k: string]: string } {
    const res: { [k: string]: string } = {};
    if (!obj || typeof obj !== 'object') return res;
    for (const k of Object.keys(obj)) {
      const val = obj[k];
      const key = prefix ? prefix + '.' + k : k;
      if (val !== null && typeof val === 'object') {
        const child = this.flatten(val, key);
        Object.assign(res, child);
      } else {
        res[key] = val == null ? '' : String(val);
      }
    }
    return res;
  }

  // Convert flat map back to nested object
  unflattenToObject(map: { [k: string]: any }): any {
    const out: any = {};
    Object.keys(map).forEach(token => {
      const parts = token.split('.');
      let cur = out;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (i === parts.length - 1) {
          cur[p] = map[token];
        } else {
          if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
          cur = cur[p];
        }
      }
    });
    return out;
  }
}

