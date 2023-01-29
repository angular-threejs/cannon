import { inject } from '@angular/core';
import { ContactMaterialOptions, MaterialOptions } from '@pmndrs/cannon-worker-api';
import { injectNgtDestroy, makeId, tapEffect } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { takeUntil } from 'rxjs';

export function injectContactMaterial(
    materialA: MaterialOptions,
    materialB: MaterialOptions,
    optionsFn: () => ContactMaterialOptions
) {
    const { destroy$ } = injectNgtDestroy();

    const physicsStore = inject(NgtcStore, { skipSelf: true });
    const uuid = makeId();

    physicsStore
        .select('worker')
        .pipe(
            tapEffect((worker) => {
                const options = optionsFn();
                worker.addContactMaterial({ props: [materialA, materialB, options], uuid });
                return () => worker.removeContactMaterial({ uuid });
            }),
            takeUntil(destroy$)
        )
        .subscribe();
}
