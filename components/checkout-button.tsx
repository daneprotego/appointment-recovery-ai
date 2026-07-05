"use client";

type CheckoutButtonProps = {
  plan: "starter" | "growth" | "pro";
  children: React.ReactNode;
  className?: string;
};

export function CheckoutButton({
  plan,
  children,
  className,
}: CheckoutButtonProps) {
  async function handleCheckout() {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Unable to start checkout.");
    }
  }

  return (
    <button type="button" onClick={handleCheckout} className={className}>
      {children}
    </button>
  );
}