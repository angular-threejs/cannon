import { inject } from '@angular/core';
import { RayhitEvent, RayMode, RayOptions } from '@pmndrs/cannon-worker-api';
import { injectNgtDestroy, makeId, tapEffect } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { takeUntil } from 'rxjs';

export function injectRaycastClosest(optionsFn: () => RayOptions, callback: (e: RayhitEvent) => void) {
    injectRay('Closest', optionsFn, callback);
}

export function injectRaycastAny(optionsFn: () => RayOptions, callback: (e: RayhitEvent) => void) {
    injectRay('Any', optionsFn, callback);
}

export function injectRaycastAll(optionsFn: () => RayOptions, callback: (e: RayhitEvent) => void) {
    injectRay('All', optionsFn, callback);
}

function injectRay(mode: RayMode, optionsFn: () => RayOptions, callback: (event: RayhitEvent) => void): void {
    const { destroy$ } = injectNgtDestroy();
    const uuid = makeId();
    const physicsStore = inject(NgtcStore, { skipSelf: true });

    physicsStore
        .select('worker')
        .pipe(
            tapEffect((worker) => {
                const opts = optionsFn();
                const events = physicsStore.get('events');
                events[uuid] = { rayhit: callback };
                worker.addRay({ props: { ...opts, mode }, uuid });
                return () => {
                    worker.removeRay({ uuid });
                    delete events[uuid];
                };
            }),
            takeUntil(destroy$)
        )
        .subscribe();
}
