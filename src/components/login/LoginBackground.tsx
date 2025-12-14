interface LoginBackgroundProps {
  backgroundImage: string | null;
  backgroundOpacity: number;
}

const LoginBackground = ({ backgroundImage, backgroundOpacity }: LoginBackgroundProps) => {
  return (
    <>
      {backgroundImage && (
        <div 
          className="absolute inset-0 backdrop-blur-sm" 
          style={{
            backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`
          }}
        />
      )}
    </>
  );
};

export default LoginBackground;
