import { inject } from '@angular/core';
import { RayhitEvent, RayMode, RayOptions } from '@pmndrs/cannon-worker-api';
import { makeId, tapEffect } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { combineLatest, Observable, takeUntil } from 'rxjs';
import { injectOptionsProcessor } from './utils';

export function injectRaycastClosest(
    optionsFn: () => Observable<RayOptions> | RayOptions,
    callback: (e: RayhitEvent) => void
) {
    injectRay('Closest', optionsFn, callback);
}

export function injectRaycastAny(
    optionsFn: () => Observable<RayOptions> | RayOptions,
    callback: (e: RayhitEvent) => void
) {
    injectRay('Any', optionsFn, callback);
}

export function injectRaycastAll(
    optionsFn: () => Observable<RayOptions> | RayOptions,
    callback: (e: RayhitEvent) => void
) {
    injectRay('All', optionsFn, callback);
}

function injectRay(
    mode: RayMode,
    optionsFn: () => Observable<RayOptions> | RayOptions,
    callback: (event: RayhitEvent) => void
): void {
    const { opts$, destroy$ } = injectOptionsProcessor(optionsFn);
    const uuid = makeId();
    const physicsStore = inject(NgtcStore, { skipSelf: true });

    combineLatest([physicsStore.select('worker'), opts$])
        .pipe(
            tapEffect(([worker, opts]) => {
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
