import { NgIf } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    CUSTOM_ELEMENTS_SCHEMA,
    EventEmitter,
    inject,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import { Triplet } from '@pmndrs/cannon-worker-api';
import { NgtArgs, NgtCanvas, NgtRxStore } from 'angular-three';
import { NgtcPhysics } from 'angular-three-cannon';
import { NgtcDebug } from 'angular-three-cannon/debug';
import { injectCompoundBody, injectPlane } from 'angular-three-cannon/services';

@Component({
    selector: 'demo-plane',
    standalone: true,
    template: `
        <ngt-group [ref]="plane.ref" [rotation]="rotation">
            <ngt-mesh>
                <ngt-plane-geometry *args="[8, 8]" />
                <ngt-mesh-basic-material color="#ffb385" />
            </ngt-mesh>
            <ngt-mesh [receiveShadow]="true">
                <ngt-plane-geometry *args="[8, 8]" />
                <ngt-shadow-material color="lightsalmon" />
            </ngt-mesh>
        </ngt-group>
    `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Plane {
    @Input() rotation: Triplet = [0, 0, 0];
    readonly plane = injectPlane<THREE.Mesh>(() => ({ type: 'Static', rotation: this.rotation }));
}

@Component({
    selector: 'demo-compound-body',
    standalone: true,
    template: `
        <ngt-group [ref]="compound.ref" [rotation]="rotation" [position]="position">
            <ngt-mesh [castShadow]="true">
                <ngt-box-geometry *args="boxSize" />
                <ngt-mesh-normal-material />
            </ngt-mesh>
            <ngt-mesh [castShadow]="true" [position]="[1, 0, 0]">
                <ngt-sphere-geometry *args="[sphereRadius, 16, 16]" />
                <ngt-mesh-normal-material />
            </ngt-mesh>
        </ngt-group>
    `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CompoundBody extends NgtRxStore implements OnInit {
    @Input() isTrigger = false;
    @Input() mass = 12;
    @Input() position: Triplet = [0, 0, 0];
    @Input() rotation: Triplet = [0, 0, 0];

    @Output() positionChange = new EventEmitter<Triplet>();
    @Output() rotationChange = new EventEmitter<Triplet>();

    readonly boxSize = [1, 1, 1];
    readonly sphereRadius = 0.65;

    readonly compound = injectCompoundBody<THREE.Group>(() => ({
        isTrigger: this.isTrigger,
        mass: this.mass,
        position: this.position,
        rotation: this.rotation,
        shapes: [
            { args: this.boxSize, position: [0, 0, 0], rotation: [0, 0, 0], type: 'Box' },
            { args: [this.sphereRadius], position: [1, 0, 0], rotation: [0, 0, 0], type: 'Sphere' },
        ],
    }));

    ngOnInit() {
        this.effect(this.compound.ref.$, () => {
            const positionSub = this.compound.api.position.subscribe(
                this.positionChange.emit.bind(this.positionChange)
            );
            const rotationSub = this.compound.api.rotation.subscribe(
                this.rotationChange.emit.bind(this.rotationChange)
            );

            return () => {
                positionSub();
                rotationSub();
            };
        });
    }
}

@Component({
    standalone: true,
    template: `
        <ngt-color *args="['#f6d186']" attach="background" />
        <ngt-hemisphere-light [intensity]="0.35" />
        <ngt-spot-light [position]="[5, 5, 5]" [angle]="0.3" [penumbra]="1" [intensity]="2" [castShadow]="true">
            <ngt-vector2 *args="[1028, 1028]" attach="shadow.mapSize" />
        </ngt-spot-light>

        <ngtc-physics [iterations]="6">
            <ngtc-debug [scale]="1.1" color="black">
                <demo-plane [rotation]="[-Math.PI / 2, 0, 0]" />
                <demo-compound-body [position]="[1.5, 5, 0.5]" [rotation]="[1.25, 0, 0]" />
                <demo-compound-body
                    [position]="[2.5, 3, 0.25]"
                    [rotation]="[1.25, -1.25, 0]"
                    (positionChange)="!copy && (position = $any($event))"
                    (rotationChange)="!copy && (rotation = $any($event))"
                />
                <demo-compound-body *ngIf="ready" [position]="[2.5, 4, 0.25]" [rotation]="[1.25, -1.25, 0]" />
                <demo-compound-body
                    *ngIf="copy"
                    [position]="position"
                    [rotation]="rotation"
                    [mass]="0"
                    [isTrigger]="true"
                />
            </ngtc-debug>
        </ngtc-physics>
    `,
    imports: [NgtArgs, NgtcPhysics, NgtcDebug, NgIf, CompoundBody, Plane],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Scene implements OnInit {
    ready = false;
    copy = false;

    position: Triplet = [0, 0, 0];
    rotation: Triplet = [0, 0, 0];

    readonly Math = Math;

    private readonly cdr = inject(ChangeDetectorRef);

    ngOnInit(): void {
        setTimeout(() => {
            this.ready = true;
            this.cdr.detectChanges();
        }, 2000);

        setTimeout(() => {
            this.copy = true;
            this.cdr.detectChanges();
        }, 1000);
    }
}

@Component({
    standalone: true,
    template: `
        <ngt-canvas
            [sceneGraph]="SceneGraph"
            [shadows]="true"
            [gl]="{ alpha: false }"
            [camera]="{ fov: 50, position: [-2, 1, 7] }"
        />
    `,
    imports: [NgtCanvas],
})
export default class DemoCompoundBody {
    readonly SceneGraph = Scene;
}
