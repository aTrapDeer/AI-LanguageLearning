import React from "react"
import { motion } from "framer-motion"

interface StatusDisplayProps {
  status: string;
}

export const StatusDisplay = ({ status }: StatusDisplayProps) => (
  <motion.div 
    className="w-full flex flex-col gap-2"
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: "auto" }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="text-sm text-muted-foreground text-center">
      {status}
    </div>
  </motion.div>
); 