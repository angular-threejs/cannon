import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';

import { extend } from 'angular-three';
import * as THREE from 'three';
import { AppComponent } from './app/app.component';

extend(THREE);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
