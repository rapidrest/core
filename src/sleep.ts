///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
/**
 * Starts a timer to suspend execution for a given number of milliseconds.
 * @param ms The number of milliseconds to suspend. Default is `1`.
 */
export async function sleep(ms: number = 1): Promise<void> {
    return await new Promise((resolve) => {
        setTimeout(async () => {
            resolve();
        }, ms);
    });
}
