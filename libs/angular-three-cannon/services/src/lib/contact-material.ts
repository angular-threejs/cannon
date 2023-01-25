import { inject } from '@angular/core';
import { ContactMaterialOptions, MaterialOptions } from '@pmndrs/cannon-worker-api';
import { makeId, tapEffect } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { combineLatest, Observable, takeUntil } from 'rxjs';
import { injectOptionsProcessor } from './utils';

export function injectContactMaterial(
    materialA: MaterialOptions,
    materialB: MaterialOptions,
    optionsFn: () => Observable<ContactMaterialOptions> | ContactMaterialOptions
) {
    const { opts$, destroy$ } = injectOptionsProcessor(optionsFn);

    const physicsStore = inject(NgtcStore, { skipSelf: true });
    const uuid = makeId();

    combineLatest([physicsStore.select('worker'), opts$])
        .pipe(
            tapEffect(([worker, options]) => {
                worker.addContactMaterial({ props: [materialA, materialB, options], uuid });
                return () => worker.removeContactMaterial({ uuid });
            }),
            takeUntil(destroy$)
        )
        .subscribe();
}
