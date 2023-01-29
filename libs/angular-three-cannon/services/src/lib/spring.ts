import { inject } from '@angular/core';
import { SpringOptns } from '@pmndrs/cannon-worker-api';
import { injectNgtDestroy, makeId, NgtInjectedRef, tapEffect } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { combineLatest, takeUntil } from 'rxjs';

export interface NgtcSpringApi {
    setDamping: (value: number) => void;
    setRestLength: (value: number) => void;
    setStiffness: (value: number) => void;
    remove: () => void;
}

export interface NgtcSpringReturn<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
> {
    bodyA: NgtInjectedRef<TObjectA>;
    bodyB: NgtInjectedRef<TObjectB>;
    api: NgtcSpringApi;
}

export function injectSpring<
    TObjectA extends THREE.Object3D = THREE.Object3D,
    TObjectB extends THREE.Object3D = THREE.Object3D
>(
    bodyA: NgtInjectedRef<TObjectA>,
    bodyB: NgtInjectedRef<TObjectB>,
    optsFn: () => SpringOptns
): NgtcSpringReturn<TObjectA, TObjectB> {
    const store = inject(NgtcStore, { skipSelf: true });
    const uuid = makeId();
    const { destroy$ } = injectNgtDestroy();

    combineLatest([store.select('worker'), bodyA.$, bodyB.$])
        .pipe(
            tapEffect(([worker, bodyA, bodyB]) => {
                const opts = optsFn();
                worker.addSpring({ props: [bodyA.uuid, bodyB.uuid, opts], uuid });
                return () => worker.removeSpring({ uuid });
            }),
            takeUntil(destroy$)
        )
        .subscribe();

    const api = {
        setDamping: (value: number) => {
            const worker = store.get('worker');
            worker.setSpringDamping({ uuid, props: value });
        },
        setRestLength: (value: number) => {
            const worker = store.get('worker');
            worker.setSpringRestLength({ uuid, props: value });
        },
        setStiffness: (value: number) => {
            const worker = store.get('worker');
            worker.setSpringStiffness({ uuid, props: value });
        },
        remove: () => {
            const worker = store.get('worker');
            worker.removeSpring({ uuid });
        },
    } as NgtcSpringApi;

    return { bodyA, bodyB, api };
}
