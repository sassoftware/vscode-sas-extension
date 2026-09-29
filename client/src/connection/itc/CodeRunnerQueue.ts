let closed = false;

export const closeCodeRunnerQueue = (): void => {
  closed = true;
};

export const resetCodeRunnerQueue = (): void => {
  closed = false;
};

export const isCodeRunnerQueueClosed = (): boolean => closed;
