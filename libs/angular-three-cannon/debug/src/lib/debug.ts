import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, InjectionToken, Input, OnInit } from '@angular/core';
import { BodyProps, BodyShapeType, propsToBody } from '@pmndrs/cannon-worker-api';
import { injectBeforeRender, NgtArgs } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { Body, Quaternion as CQuarternion, Vec3, World } from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import * as THREE from 'three';

const q = new THREE.Quaternion();
const s = new THREE.Vector3(1, 1, 1);
const v = new THREE.Vector3();
const m = new THREE.Matrix4();

function getMatrix(o: THREE.Object3D): THREE.Matrix4 {
    if (o instanceof THREE.InstancedMesh) {
        o.getMatrixAt(parseInt(o.uuid.split('/')[1]), m);
        return m;
    }
    return o.matrix;
}

export type NgtcDebugApi = {
    add(id: string, props: BodyProps, type: BodyShapeType): void;
    remove(id: string): void;
};

export const NGTC_DEBUG_API = new InjectionToken<NgtcDebugApi>('NgtcDebug API');

@Component({
    selector: 'ngtc-debug',
    standalone: true,
    template: `
        <ngt-primitive *args="[scene]" />
        <ng-content />
    `,
    providers: [
        {
            provide: NGTC_DEBUG_API,
            useFactory: (debug: NgtcDebug) => ({
                add: (uuid: string, props: BodyProps, type: BodyShapeType) => {
                    const body = propsToBody({ uuid, props, type });
                    debug.bodies.push(body);
                    debug.bodyMap[uuid] = body;
                },
                remove: (id: string) => {
                    const debugBodyIndex = debug.bodies.indexOf(debug.bodyMap[id]);
                    if (debugBodyIndex > -1) debug.bodies.splice(debugBodyIndex, 1);
                    delete debug.bodyMap[id];
                },
            }),
            deps: [NgtcDebug],
        },
    ],
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NgtcDebug implements OnInit {
    @Input() color = 'black';
    @Input() scale = 1;
    @Input() impl = CannonDebugger;
    @Input() disabled = false;

    readonly bodies: Body[] = [];
    readonly bodyMap: Record<string, Body> = {};
    readonly scene = new THREE.Scene();

    private readonly physicsStore = inject(NgtcStore, { skipSelf: true });

    private cannonDebugger!: ReturnType<typeof CannonDebugger>;

    constructor() {
        injectBeforeRender(() => {
            if (!this.cannonDebugger) return;
            const refs = this.physicsStore.get('refs');
            for (const uuid in this.bodyMap) {
                getMatrix(refs[uuid]).decompose(v, q, s);
                this.bodyMap[uuid].position.copy(v as unknown as Vec3);
                this.bodyMap[uuid].quaternion.copy(q as unknown as CQuarternion);
            }

            for (const child of this.scene.children) {
                child.visible = !this.disabled;
            }

            if (!this.disabled) {
                this.cannonDebugger.update();
            }
        });
    }

    ngOnInit() {
        this.cannonDebugger = this.impl(this.scene, { bodies: this.bodies } as World, {
            color: this.color,
            scale: this.scale,
        });
    }
}
