import { Injectable, OnDestroy } from '@angular/core';
import type {
    CannonWorkerAPI,
    CannonWorkerProps,
    CollideBeginEvent,
    CollideEndEvent,
    CollideEvent,
    RayhitEvent,
    Refs,
    Subscriptions,
} from '@pmndrs/cannon-worker-api';
import { makeId, NgtRxStore } from 'angular-three';

export type NgtcEvent = CollideBeginEvent | CollideEndEvent | CollideEvent | RayhitEvent;
export type NgtcCallbackByType<T extends { type: string }> = {
    [K in T['type']]?: T extends { type: K } ? (e: T) => void : never;
};

export type NgtcEvents = {
    [uuid: string]: Partial<NgtcCallbackByType<NgtcEvent>>;
};

export type NgtcScaleOverrides = { [uuid: string]: THREE.Vector3 };

export interface NgtcState {
    bodies: { [uuid: string]: number };
    events: NgtcEvents;
    refs: Refs;
    scaleOverrides: NgtcScaleOverrides;
    subscriptions: Subscriptions;
    worker: CannonWorkerAPI;
    init: (inputs: CannonWorkerProps) => void;
}

@Injectable()
export class NgtcStore extends NgtRxStore<NgtcState> implements OnDestroy {
    private readonly optionsQueue: Record<string, () => void> = {};
    override initialize() {
        super.initialize();
        this.set({
            bodies: {},
            events: {},
            refs: {},
            scaleOverrides: {},
            subscriptions: {},
            optionsQueueNotifier: Date.now(),
        });

        queueMicrotask(() => {
            this.run();
            this.hold(this.select('optionsQueueNotifier'), () => {
                if (Object.keys(this.optionsQueue).length) {
                    this.run();
                }
            });
        });
    }

    queue(cb: () => void) {
        const id = makeId();
        this.optionsQueue[id] = cb;
        this.set({ optionsQueueNotifier: Date.now() });
        return id;
    }

    remove(id: string) {
        delete this.optionsQueue[id];
    }

    private run() {
        for (const id of Object.keys(this.optionsQueue)) {
            const cb = this.optionsQueue[id];
            cb();
            this.remove(id);
        }
    }
}
