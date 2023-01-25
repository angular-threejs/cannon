import { inject } from '@angular/core';
import {
    AtomicName,
    AtomicProps,
    BodyProps,
    BodyShapeType,
    BoxProps,
    CompoundBodyProps,
    ConvexPolyhedronArgs,
    ConvexPolyhedronProps,
    CylinderProps,
    HeightfieldProps,
    ParticleProps,
    PlaneProps,
    PropValue,
    Quad,
    SetOpName,
    SphereArgs,
    SphereProps,
    TrimeshProps,
    Triplet,
    VectorName,
} from '@pmndrs/cannon-worker-api';
import { injectNgtDestroy, injectNgtRef, NgtInjectedRef, tapEffect } from 'angular-three';
import { NgtcStore, NgtcUtils } from 'angular-three-cannon';
import { NGTC_DEBUG_API } from 'angular-three-cannon/debug';
import { combineLatest, isObservable, Observable, of, ReplaySubject, Subscription, switchMap } from 'rxjs';
import * as THREE from 'three';

export type NgtcAtomicApi<K extends AtomicName> = {
    set: (value: AtomicProps[K]) => void;
    subscribe: (callback: (value: AtomicProps[K]) => void) => () => void;
};

export type NgtcQuaternionApi = {
    copy: ({ w, x, y, z }: THREE.Quaternion) => void;
    set: (x: number, y: number, z: number, w: number) => void;
    subscribe: (callback: (value: Quad) => void) => () => void;
};

export type NgtcVectorApi = {
    copy: ({ x, y, z }: THREE.Vector3 | THREE.Euler) => void;
    set: (x: number, y: number, z: number) => void;
    subscribe: (callback: (value: Triplet) => void) => () => void;
};

export type NgtcWorkerApi = {
    [K in AtomicName]: NgtcAtomicApi<K>;
} & {
    [K in VectorName]: NgtcVectorApi;
} & {
    applyForce: (force: Triplet, worldPoint: Triplet) => void;
    applyImpulse: (impulse: Triplet, worldPoint: Triplet) => void;
    applyLocalForce: (force: Triplet, localPoint: Triplet) => void;
    applyLocalImpulse: (impulse: Triplet, localPoint: Triplet) => void;
    applyTorque: (torque: Triplet) => void;
    quaternion: NgtcQuaternionApi;
    rotation: NgtcVectorApi;
    scaleOverride: (scale: Triplet) => void;
    sleep: () => void;
    wakeUp: () => void;
    remove: () => void;
};

export interface NgtcBodyPublicApi extends NgtcWorkerApi {
    at: (index: number) => NgtcWorkerApi;
}

export interface NgtcBodyReturn<TObject extends THREE.Object3D> {
    ref: NgtInjectedRef<TObject>;
    api: NgtcBodyPublicApi;
}

export type NgtcGetByIndex<T extends BodyProps> = (index: number) => T | Observable<T>;
export type NgtcArgFn<T> = (args: T) => unknown[];

export function injectPlane<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<PlaneProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<PlaneProps, TObject>('Plane', fn, () => [], opts);
}

export function injectBox<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<BoxProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    const defaultBoxArgs: Triplet = [1, 1, 1];
    return injectBody<BoxProps, TObject>('Box', fn, (args = defaultBoxArgs): Triplet => args, opts);
}

export function injectCylinder<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<CylinderProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<CylinderProps, TObject>('Cylinder', fn, (args = [] as []) => args, opts);
}

export function injectHeightfield<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<HeightfieldProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<HeightfieldProps, TObject>('Heightfield', fn, (args) => args, opts);
}

export function injectParticle<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<ParticleProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<ParticleProps, TObject>('Particle', fn, () => [], opts);
}

export function injectSphere<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<SphereProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<SphereProps, TObject>(
        'Sphere',
        fn,
        (args: SphereArgs = [1]): SphereArgs => {
            if (!Array.isArray(args)) throw new Error('injectSphere args must be an array');
            return [args[0]];
        },
        opts
    );
}

export function injectTrimesh<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<TrimeshProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<TrimeshProps, TObject>('Trimesh', fn, (args) => args, opts);
}

export function injectConvexPolyhedron<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<ConvexPolyhedronProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<ConvexPolyhedronProps, TObject>(
        'ConvexPolyhedron',
        fn,
        ([vertices, faces, normals, axes, boundingSphereRadius] = []): ConvexPolyhedronArgs<Triplet> => [
            vertices && vertices.map(NgtcUtils.makeTriplet),
            faces,
            normals && normals.map(NgtcUtils.makeTriplet),
            axes && axes.map(NgtcUtils.makeTriplet),
            boundingSphereRadius,
        ],
        opts
    );
}

export function injectCompoundBody<TObject extends THREE.Object3D>(
    fn: NgtcGetByIndex<CompoundBodyProps>,
    opts?: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> }
) {
    return injectBody<CompoundBodyProps, TObject>('Compound', fn, (args) => args as unknown[], opts);
}

const temp = new THREE.Object3D();

function injectBody<TBodyProps extends BodyProps, TObject extends THREE.Object3D>(
    type: BodyShapeType,
    getPropsFn: NgtcGetByIndex<TBodyProps>,
    argsFn: NgtcArgFn<TBodyProps['args']>,
    { ref, waitFor }: { ref?: NgtInjectedRef<TObject>; waitFor?: Observable<unknown> } = {}
): NgtcBodyReturn<TObject> {
    let subscription: Subscription | undefined = undefined;

    // a ReplaySubject that would emit once in queueMicrotask call
    const microQueue$ = new ReplaySubject<void>(1);
    // a ReplaySubject that would emit whenever our props emits. This is done so that the consumers can pass in
    // Observable to injectBody if they have reactive props (eg: Input)
    const propsSubjectList = [] as ReplaySubject<TBodyProps>[];

    // an array of streams we want to wait to emit until we decide to give the bodyRef an empty Object3D
    const waits$ = [microQueue$] as Observable<unknown>[];

    const debugApi = inject(NGTC_DEBUG_API, { skipSelf: true, optional: true });
    const physicsStore = inject(NgtcStore, { skipSelf: true });

    // clean up our streams on destroy
    injectNgtDestroy(() => {
        microQueue$.complete();
        propsSubjectList.forEach((sub) => sub.complete());
        subscription?.unsubscribe();
    });

    // give our bodyRef an NgtInjectedRef
    let bodyRef = injectNgtRef<TObject>();

    // add waitFor if the consumers pass it in
    if (waitFor) waits$.push(waitFor);
    // re-assign bodyRef if the consumers pass a ref in
    if (ref) bodyRef = ref;

    // fire microQueue$
    queueMicrotask(() => microQueue$.next());

    // when all waits$ emit, we give bodyRef an empty Object3D if it doesn't have one. Physic Object can still be affected
    // by Physics without a visual representation
    combineLatest(waits$).subscribe(() => (bodyRef.nativeElement ||= new THREE.Object3D() as TObject));

    // start the pipeline as soon as bodyRef has a truthy value
    subscription = combineLatest([physicsStore.select('worker'), bodyRef.$])
        .pipe(
            switchMap(([worker, object]) => {
                const currentWorker = worker;

                const { events, refs } = physicsStore.get();
                let objectCount = 1;

                if (object instanceof THREE.InstancedMesh) {
                    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    objectCount = object.count;
                }

                // consolidate our uuids into an Array so we can handle them in a more consistent way
                const uuids =
                    object instanceof THREE.InstancedMesh
                        ? new Array(objectCount).fill(0).map((_, i) => `${object.uuid}/${i}`)
                        : [object.uuid];

                // construct an Array<Observable> from getPropsFn
                // so we can react to props changed
                const propsList$ = uuids.map((uuid, index) => {
                    if (propsSubjectList[index]) {
                        propsSubjectList[index].complete();
                    }
                    propsSubjectList[index] = new ReplaySubject<TBodyProps>(1);
                    const propsResult = getPropsFn(index);
                    // TODO  we use a propsSubject$ because we want to ensure this propsResult stream is HOT
                    // otherwise, tapEffect will remove everything from currentWorker#bodies because the stream completes
                    (isObservable(propsResult) ? propsResult : of(propsResult)).subscribe({
                        next: (props) => {
                            NgtcUtils.prepare(temp, props);
                            if (object instanceof THREE.InstancedMesh) {
                                object.setMatrixAt(index, temp.matrix);
                                object.instanceMatrix.needsUpdate = true;
                            }
                            refs[uuid] = object;
                            debugApi?.add(uuid, props, type);
                            NgtcUtils.setupCollision(events, props, uuid);
                            propsSubjectList[index].next({ ...props, args: argsFn(props.args) });
                        },
                        error: (error) => {
                            console.error(`[NGT Cannon] Error with processing props: ${error}`);
                            propsSubjectList[index].error(error);
                        },
                    });

                    return propsSubjectList[index];
                });

                return combineLatest(propsList$).pipe(
                    tapEffect((props) => {
                        currentWorker.addBodies({
                            props: props.map(({ onCollide, onCollideBegin, onCollideEnd, ...serializableProps }) => ({
                                onCollide: Boolean(onCollide),
                                onCollideBegin: Boolean(onCollideBegin),
                                onCollideEnd: Boolean(onCollideEnd),
                                ...serializableProps,
                            })),
                            type,
                            uuid: uuids,
                        });
                        // clean up CannonWorker whenever props changes/completes
                        return () => {
                            uuids.forEach((uuid) => {
                                delete refs[uuid];
                                debugApi?.remove(uuid);
                                delete events[uuid];
                            });
                            currentWorker.removeBodies({ uuid: uuids });
                        };
                    })
                );
            })
        )
        .subscribe();

    const makeAtomic = <T extends AtomicName>(type: T, index?: number) => {
        const op: SetOpName<T> = `set${NgtcUtils.capitalize(type)}`;

        return {
            set: (value: PropValue<T>) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker[op]({ props: value, uuid } as never);
            },
            get subscribe() {
                const { subscriptions, worker } = physicsStore.get();
                return NgtcUtils.subscribe(bodyRef, worker, subscriptions, type, index);
            },
        };
    };

    const makeQuaternion = (index?: number) => {
        const type = 'quaternion';
        return {
            copy: ({ w, x, y, z }: THREE.Quaternion) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.setQuaternion({ props: [x, y, z, w], uuid });
            },
            set: (x: number, y: number, z: number, w: number) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.setQuaternion({ props: [x, y, z, w], uuid });
            },
            get subscribe() {
                const { subscriptions, worker } = physicsStore.get();
                return NgtcUtils.subscribe(bodyRef, worker, subscriptions, type, index);
            },
        };
    };

    const makeRotation = (index?: number) => {
        return {
            copy: ({ x, y, z }: THREE.Vector3 | THREE.Euler) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.setRotation({ props: [x, y, z], uuid });
            },
            set: (x: number, y: number, z: number) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.setRotation({ props: [x, y, z], uuid });
            },
            subscribe: (callback: (value: Triplet) => void) => {
                const { subscriptions, worker } = physicsStore.get();
                const id = NgtcUtils.incrementingId++;
                const target = 'bodies';
                const type = 'quaternion';
                const uuid = NgtcUtils.getUUID(bodyRef, index);

                subscriptions[id] = { [type]: NgtcUtils.quaternionToRotation(callback) };
                uuid && worker.subscribe({ props: { id, target, type }, uuid });
                return () => {
                    delete subscriptions[id];
                    worker.unsubscribe({ props: id });
                };
            },
        };
    };

    const makeVec = (type: VectorName, index?: number) => {
        const op: SetOpName<VectorName> = `set${NgtcUtils.capitalize(type)}`;
        return {
            copy: ({ x, y, z }: THREE.Vector3 | THREE.Euler) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker[op]({ props: [x, y, z], uuid });
            },
            set: (x: number, y: number, z: number) => {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker[op]({ props: [x, y, z], uuid });
            },
            get subscribe() {
                const { subscriptions, worker } = physicsStore.get();
                return NgtcUtils.subscribe(bodyRef, worker, subscriptions, type, index);
            },
        };
    };

    const makeRemove = (index?: number) => {
        const { worker } = physicsStore.get();
        const uuid = NgtcUtils.getUUID(bodyRef, index);
        return () => {
            if (uuid) worker.removeBodies({ uuid: [uuid] });
        };
    };

    function makeApi(index?: number): NgtcWorkerApi {
        return {
            allowSleep: makeAtomic('allowSleep', index),
            angularDamping: makeAtomic('angularDamping', index),
            angularFactor: makeVec('angularFactor', index),
            angularVelocity: makeVec('angularVelocity', index),
            applyForce(force: Triplet, worldPoint: Triplet) {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.applyForce({ props: [force, worldPoint], uuid });
            },
            applyImpulse(impulse: Triplet, worldPoint: Triplet) {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.applyImpulse({ props: [impulse, worldPoint], uuid });
            },
            applyLocalForce(force: Triplet, localPoint: Triplet) {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.applyLocalForce({ props: [force, localPoint], uuid });
            },
            applyLocalImpulse(impulse: Triplet, localPoint: Triplet) {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.applyLocalImpulse({ props: [impulse, localPoint], uuid });
            },
            applyTorque(torque: Triplet) {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.applyTorque({ props: [torque], uuid });
            },
            collisionFilterGroup: makeAtomic('collisionFilterGroup', index),
            collisionFilterMask: makeAtomic('collisionFilterMask', index),
            collisionResponse: makeAtomic('collisionResponse', index),
            fixedRotation: makeAtomic('fixedRotation', index),
            isTrigger: makeAtomic('isTrigger', index),
            linearDamping: makeAtomic('linearDamping', index),
            linearFactor: makeVec('linearFactor', index),
            mass: makeAtomic('mass', index),
            material: makeAtomic('material', index),
            position: makeVec('position', index),
            quaternion: makeQuaternion(index),
            remove: makeRemove(index),
            rotation: makeRotation(index),
            scaleOverride(scale) {
                const { scaleOverrides } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                if (uuid) scaleOverrides[uuid] = new THREE.Vector3(...scale);
            },
            sleep() {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.sleep({ uuid });
            },
            sleepSpeedLimit: makeAtomic('sleepSpeedLimit', index),
            sleepTimeLimit: makeAtomic('sleepTimeLimit', index),
            userData: makeAtomic('userData', index),
            velocity: makeVec('velocity', index),
            wakeUp() {
                const { worker } = physicsStore.get();
                const uuid = NgtcUtils.getUUID(bodyRef, index);
                uuid && worker.wakeUp({ uuid });
            },
        };
    }

    const cache: { [index: number]: NgtcWorkerApi } = {};
    const api = { ...makeApi(undefined), at: (index: number) => cache[index] || (cache[index] = makeApi(index)) };
    return { ref: bodyRef, api };
}
