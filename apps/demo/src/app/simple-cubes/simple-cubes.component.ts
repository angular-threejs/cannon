import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { Triplet } from '@pmndrs/cannon-worker-api';
import { NgtArgs, NgtCanvas } from 'angular-three';
import { NgtcPhysics } from 'angular-three-cannon';
import { NgtcDebug } from 'angular-three-cannon/debug';
import { injectBox, injectPlane } from 'angular-three-cannon/services';

@Component({
    selector: 'floor',
    standalone: true,
    template: `
        <ngt-mesh [ref]="plane.ref" [receiveShadow]="true">
            <ngt-plane-geometry *args="args" />
            <ngt-shadow-material transparent color="#171717" opacity="0.4" />
        </ngt-mesh>
    `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Floor {
    @Input() position: Triplet = [0, 0, 0];
    readonly rotation = [-Math.PI / 2, 0, 0] as Triplet;
    readonly args = [1000, 1000];

    readonly plane = injectPlane<THREE.Mesh>(() => ({
        args: this.args,
        position: this.position,
        rotation: this.rotation,
    }));
}

@Component({
    selector: 'cube',
    standalone: true,
    template: `
        <ngt-mesh [ref]="box.ref" [receiveShadow]="true" [castShadow]="true">
            <ngt-box-geometry />
            <ngt-mesh-lambert-material color="hotpink" />
        </ngt-mesh>
    `,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Cube {
    @Input() position: Triplet = [0, 0, 0];
    readonly rotation = [0.4, 0.2, 0.5] as Triplet;
    readonly box = injectBox<THREE.Mesh>(() => ({ mass: 1, position: this.position, rotation: this.rotation }));
}

@Component({
    standalone: true,
    template: `
        <ngt-color *args="['skyblue']" attach="background" />

        <ngt-ambient-light />
        <ngt-directional-light [position]="10" [castShadow]="true">
            <ngt-vector2 *args="[2048, 2048]" attach="shadow.mapSize" />
        </ngt-directional-light>

        <ngtc-physics>
            <ngtc-debug>
                <floor [position]="[0, -2.5, 0]" />
                <cube [position]="[0.1, 5, 0]" />
                <cube [position]="[0, 10, -1]" />
                <cube [position]="[0, 20, -2]" />
            </ngtc-debug>
        </ngtc-physics>
    `,
    imports: [NgtcPhysics, NgtcDebug, NgtArgs, Floor, Cube],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Scene {}

@Component({
    standalone: true,
    template: `
        <ngt-canvas
            [sceneGraph]="Scene"
            [shadows]="true"
            [gl]="{ alpha: false }"
            [camera]="{ position: [-1, 5, 5], fov: 45 }"
        />
    `,
    imports: [NgtCanvas],
})
export default class DemoSimpleCubes {
    readonly Scene = Scene;
}
