import "@testing-library/jest-dom";
import { notifyManager } from "@tanstack/react-query";
import { act } from "@testing-library/react";

notifyManager.setNotifyFunction((callback) => {
  act(() => {
    callback();
  });
});
