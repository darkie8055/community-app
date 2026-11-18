type Confirmation = { confirm: (code: string) => Promise<unknown> };
type Dependencies = {
  observe: (phone: string, onVerified: () => void) => Promise<() => void>;
  send: (phone: string) => Promise<Confirmation>;
  complete: (name: string, isCurrent: () => boolean) => Promise<void>;
  onError: (error: unknown) => void;
  onCompleting: (busy: boolean) => void;
};

/** Coordinates Android automatic verification and explicit SMS confirmation. */
export class PhoneSignInFlow {
  private generation = 0;
  private unsubscribe?: () => void;
  private confirmation?: Confirmation;
  private completion?: Promise<void>;
  private verified = false;
  private name = "";
  constructor(private dependencies: Dependencies) {}

  cancel() {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.confirmation = undefined;
    this.completion = undefined;
    this.verified = false;
  }

  async start(name: string, phone: string): Promise<boolean> {
    this.cancel();
    const generation = this.generation;
    this.name = name;
    const stop = await this.dependencies.observe(phone, () => {
      if (generation !== this.generation) return;
      this.verified = true;
      void this.finish(generation).catch((error) => {
        if (generation === this.generation) this.dependencies.onError(error);
      });
    });
    if (generation !== this.generation) {
      stop();
      return false;
    }
    this.unsubscribe = stop;
    if (this.verified) {
      await this.finish(generation);
      return false;
    }
    const confirmation = await this.dependencies.send(phone);
    if (generation !== this.generation) return false;
    this.confirmation = confirmation;
    if (this.verified) {
      await this.finish(generation);
      return false;
    }
    return true;
  }

  async confirm(code: string) {
    const generation = this.generation;
    if (this.verified) {
      await this.finish(generation);
      return;
    }
    if (!this.confirmation)
      throw new Error("Request a verification code first.");
    await this.confirmation.confirm(code);
    if (generation !== this.generation) return;
    this.verified = true;
    await this.finish(generation);
  }

  private finish(generation: number): Promise<void> {
    if (generation !== this.generation) return Promise.resolve();
    if (this.completion) return this.completion;
    this.dependencies.onCompleting(true);
    const current = () => generation === this.generation;
    const pending = Promise.resolve().then(() =>
      current() ? this.dependencies.complete(this.name, current) : undefined,
    );
    this.completion = pending;
    void pending.then(
      () => {
        if (current()) {
          this.unsubscribe?.();
          this.unsubscribe = undefined;
          this.dependencies.onCompleting(false);
        }
      },
      () => {
        if (current()) {
          this.completion = undefined;
          this.dependencies.onCompleting(false);
        }
      },
    );
    return pending;
  }
}
