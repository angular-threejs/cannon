import { filter, MonoTypeOperatorFunction } from 'rxjs';

export function filterEmpty<T>(): MonoTypeOperatorFunction<T> {
    return filter<T>((obj): obj is T => obj != null);
}
