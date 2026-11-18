import { useRef, useState } from "react";
import { ChoiceMenu } from "../../src/components/ui/choice-menu";

export function Example() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [value, setValue] = useState("one");

  return (
    <>
      <ChoiceMenu
        menuRef={menuRef}
        label="Example choice"
        value={value}
        valueLabel={value === "one" ? "One" : "Two"}
        options={[
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
        ]}
        onChange={setValue}
      />
      <button type="button">Outside</button>
    </>
  );
}
