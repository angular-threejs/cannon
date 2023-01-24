import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgtCanvas } from 'angular-three';

@Component({
    standalone: true,
    template: `
        text
    `,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Scene {}

@Component({
    standalone: true,
    template: `
        <ngt-canvas [sceneGraph]="Scene" />
    `,
    imports: [NgtCanvas],
})
export default class DemoSimpleCubes {
    readonly Scene = Scene;
}
