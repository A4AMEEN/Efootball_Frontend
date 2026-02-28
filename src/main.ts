import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';  // ← make sure this import exists

bootstrapApplication(App, appConfig).catch(err => console.error(err));
// No providers: [...] block here anymore