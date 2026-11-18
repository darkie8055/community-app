import type { ImageSourcePropType } from "react-native";

// Metro needs literal paths to include these photos in offline native builds.
export const samplePhotos: Record<string, ImageSourcePropType> = {
  "sample:apartment": require("../../assets/images/resident/apartment.jpg"),
  "sample:garden": require("../../assets/images/resident/garden.jpg"),
  "sample:chair": require("../../assets/images/resident/chair.jpg"),
  "sample:bicycle": require("../../assets/images/resident/bicycle.jpg"),
  "sample:plant": require("../../assets/images/resident/plant.jpg"),
  "sample:bookcase": require("../../assets/images/resident/bookcase.jpg"),
  "sample:cleaning": require("../../assets/images/resident/cleaning.jpg"),
  "sample:ac": require("../../assets/images/resident/ac.jpg"),
};
