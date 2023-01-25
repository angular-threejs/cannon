import { inject } from '@angular/core';
import {
    ConeTwistConstraintOpts,
    ConstraintOptns,
    ConstraintTypes,
    DistanceConstraintOpts,
    HingeConstraintOpts,
    LockConstraintOpts,
    PointToPointConstraintOpts,
} from '@pmndrs/cannon-worker-api';
import { injectNgtDestroy, injectNgtRef, is, makeId, NgtInjectedRef, tapEffect } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { combineLatest, isObservable, Observable, of, ReplaySubject, Subscription, takeUntil } from 'rxjs';

export interface NgtcConstraintApi {
    disable: () => void;
    enable: () => void;
    remove: () => void;
}

export interface NgtcHingeConstraintApi extends NgtcConstraintApi {
    disableMotor: () => void;
    enableMotor: () => void;
    setMotorMaxForce: (value: number) => void;
    setMotorSpeed: (value: number) => void;
}

export type NgtcConstraintORHingeApi<T extends 'Hinge' | ConstraintTypes> = T extends ConstraintTypes
    ? NgtcConstraintApi
    : NgtcHingeConstraintApi;

export interface NgtcConstraintReturn<
    T extends 'Hinge' | ConstraintTypes,
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
> {
    bodyA: NgtInjectedRef<TObjectA>;
    bodyB: NgtInjectedRef<TObjectB>;
    api: NgtcConstraintORHingeApi<T>;
}

export type NgtcOptsFunction<
    TConstraintType extends 'Hinge' | ConstraintTypes,
    TOptions extends HingeConstraintOpts | ConstraintOptns = TConstraintType extends 'Hinge'
        ? HingeConstraintOpts
        : ConstraintOptns
> = () => Observable<TOptions> | TOptions;

export function injectPointToPointConstraint<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
>(
    bodyA: NgtInjectedRef<TObjectA> | TObjectA,
    bodyB: NgtInjectedRef<TObjectB> | TObjectB,
    optsFn?: NgtcOptsFunction<'PointToPoint', PointToPointConstraintOpts>
) {
    return injectConstraint('PointToPoint', bodyA, bodyB, optsFn);
}

export function injectConeTwistConstraint<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
>(
    bodyA: NgtInjectedRef<TObjectA> | TObjectA,
    bodyB: NgtInjectedRef<TObjectB> | TObjectB,
    optsFn?: NgtcOptsFunction<'ConeTwist', ConeTwistConstraintOpts>
) {
    return injectConstraint('ConeTwist', bodyA, bodyB, optsFn);
}

export function injectDistanceConstraint<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
>(
    bodyA: NgtInjectedRef<TObjectA> | TObjectA,
    bodyB: NgtInjectedRef<TObjectB> | TObjectB,
    optsFn?: NgtcOptsFunction<'Distance', DistanceConstraintOpts>
) {
    return injectConstraint('Distance', bodyA, bodyB, optsFn);
}

export function injectHingeConstraint<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
>(
    bodyA: NgtInjectedRef<TObjectA> | TObjectA,
    bodyB: NgtInjectedRef<TObjectB> | TObjectB,
    optsFn?: NgtcOptsFunction<'Hinge', HingeConstraintOpts>
) {
    return injectConstraint('Hinge', bodyA, bodyB, optsFn);
}

export function injectLockConstraint<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
>(
    bodyA: NgtInjectedRef<TObjectA> | TObjectA,
    bodyB: NgtInjectedRef<TObjectB> | TObjectB,
    optsFn?: NgtcOptsFunction<'Lock', LockConstraintOpts>
) {
    return injectConstraint('Lock', bodyA, bodyB, optsFn);
}

function injectConstraint<
    TConstraintType extends 'Hinge' | ConstraintTypes,
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D,
    TOptions extends HingeConstraintOpts | ConstraintOptns = TConstraintType extends 'Hinge'
        ? HingeConstraintOpts
        : ConstraintOptns
>(
    type: TConstraintType,
    bodyA: NgtInjectedRef<TObjectA> | TObjectA,
    bodyB: NgtInjectedRef<TObjectB> | TObjectB,
    optsFn: NgtcOptsFunction<TConstraintType, TOptions> = () => ({} as TOptions)
): NgtcConstraintReturn<TConstraintType, TObjectA, TObjectB> {
    const uuid = makeId();
    const optsSubject = new ReplaySubject<TOptions>(1);
    let subscription: Subscription | undefined = undefined;

    const physicsStore = inject(NgtcStore, { skipSelf: true });
    const { destroy$ } = injectNgtDestroy(() => {
        optsSubject.complete();
        subscription?.unsubscribe();
    });

    const bodyARef = !is.ref(bodyA) ? injectNgtRef(bodyA) : bodyA;
    const bodyBRef = !is.ref(bodyB) ? injectNgtRef(bodyB) : bodyB;

    queueMicrotask(() => {
        const opts = optsFn();
        (isObservable(opts) ? opts : of(opts)).pipe(takeUntil(destroy$)).subscribe({
            next: optsSubject.next.bind(optsSubject),
            error: (error) => {
                console.error(`[NGT Cannon] Error processing props for injectConstraint`, error);
                optsSubject.error(error);
            },
        });
    });

    subscription = combineLatest([physicsStore.select('worker'), bodyARef.$, bodyBRef.$, optsSubject])
        .pipe(
            tapEffect(([worker, bodyA, bodyB, opts]) => {
                worker.addConstraint({ props: [bodyA.uuid, bodyB.uuid, opts], type, uuid });
                return () => worker.removeConstraint({ uuid });
            })
        )
        .subscribe();

    const api = {
        disable: () => {
            const worker = physicsStore.get('worker');
            worker.disableConstraint({ uuid });
        },
        enable: () => {
            const worker = physicsStore.get('worker');
            worker.enableConstraint({ uuid });
        },
        remove: () => {
            const worker = physicsStore.get('worker');
            worker.removeConstraint({ uuid });
        },
    } as NgtcConstraintORHingeApi<TConstraintType>;

    if (type === 'Hinge') {
        const hingeApi = api as NgtcHingeConstraintApi;
        hingeApi.disableMotor = () => {
            const worker = physicsStore.get('worker');
            worker.disableConstraintMotor({ uuid });
        };

        hingeApi.enableMotor = () => {
            const worker = physicsStore.get('worker');
            worker.enableConstraintMotor({ uuid });
        };

        hingeApi.setMotorSpeed = (value: number) => {
            const worker = physicsStore.get('worker');
            worker.setConstraintMotorSpeed({ uuid, props: value });
        };

        hingeApi.setMotorMaxForce = (value: number) => {
            const worker = physicsStore.get('worker');
            worker.setConstraintMotorMaxForce({ uuid, props: value });
        };
    }

    return { bodyA: bodyARef, bodyB: bodyBRef, api };
}
