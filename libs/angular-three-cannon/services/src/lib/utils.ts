import { inject } from '@angular/core';
import { injectNgtDestroy } from 'angular-three';
import { NgtcStore } from 'angular-three-cannon';
import { isObservable, Observable, of, ReplaySubject, Subscription, takeUntil } from 'rxjs';

export function injectOptionsProcessor<TOptions extends object>(
    optsFn: () => Observable<TOptions> | TOptions,
    {
        optsTransformer,
        extraDestroyCallback,
    }: {
        optsTransformer?: (value: TOptions, sub: ReplaySubject<TOptions>) => void;
        extraDestroyCallback?: () => void;
    } = {}
) {
    const optsSubject = new ReplaySubject<TOptions>(1);
    let subscription: Subscription | undefined = undefined;
    const physicsStore = inject(NgtcStore, { skipSelf: true });

    const id = physicsStore.queue(() => {
        const opts = optsFn();
        subscription = (isObservable(opts) ? opts : of(opts)).subscribe({
            next: (value) => {
                if (optsTransformer) optsTransformer(value, optsSubject);
                else optsSubject.next(value);
            },
            error: (error) => {
                console.error(`[NGT Cannon] error processing options`);
                optsSubject.error(error);
            },
        });
    });

    const { destroy$ } = injectNgtDestroy(() => {
        optsSubject.complete();
        subscription?.unsubscribe();
        physicsStore.remove(id);
        extraDestroyCallback?.();
    });
    const opts$ = optsSubject.asObservable().pipe(takeUntil(destroy$));

    return { opts$, destroy$ };
}
