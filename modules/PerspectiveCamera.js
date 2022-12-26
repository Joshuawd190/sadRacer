export default class PerspectiveCamera{
    constructor(x,y,z,rotx,roty,rotz)
    {
        //make all camera properties self contained here
        this.cameraX = 0 || x
        this.cameraY = 0 || y
        this.cameraZ = 0 || z
        this.camRotX = 0 || rotx
        this.camRotY = 0 || roty
        this.camRotZ = 0 || rotz
        this.FOV = 100
        this.cameraDepth =  1 / Math.tan((this.fieldOfView/2) * Math.PI/180)

    }

    project(point){
        this.update()

        projectv2(p, cameraX, cameraY, cameraZ, angleX, angleY, angleZ, cameraDepth, width, roadWidth)
            /*
            P (x,y,z) – the 3D position of a point P that is to be projected.
            C (x,y,z) – the 3D position of a point C representing the camera.
            Angle (x,y,z) – The orientation of the camera (represented by Tait–Bryan angles).
            e (x,y,z) – the display surface's position relative to the camera. (width/2, height/2, cameraDepth)
            Screen (x,y) – the 2D projection of P
            Let d(x,y,z) = point P(x,y,z) after camera transform
            */
        
            //X = PointX - CameraX
            p.camera.x = (p.world.x || 0) - cameraX
            //Y = PointY - CameraY
            p.camera.y = (p.world.y || 0) - cameraY
            //Z = PointZ - CameraZ
            p.camera.z = (p.world.z || 0) - cameraZ
        
            let Cx = Math.cos(((angleX ||0) * (Math.PI/180)))
            let Cy = Math.cos(((angleY || 0) * (Math.PI/180)))
            let Cz = Math.cos(((angleZ || 0) * (Math.PI/180)))
        
            let Sx = Math.sin(((angleX ||0) * (Math.PI/180)))
            let Sy = Math.sin(((angleY || 0) * (Math.PI/180)))
            let Sz = Math.sin(((angleZ || 0) * (Math.PI/180)))
        
            let dx = Cy * (Sz * p.camera.y + Cz * p.camera.x) - Sy * p.camera.z
            let dy = Sx * (Cy * p.camera.z + Sy * (Sz * p.camera.y + Cz * p.camera.x)) + Cx * (Cz * p.camera.y - Sz * p.camera.x)
            let dz = Cx * (Cy * p.camera.z + Sy * (Sz * p.camera.y + Cz* p.camera.x)) - Sx * (Cz * p.camera.y - Sz * p.camera.x)
        
            //the screen location of d after the desired camera transform is calcuated by
            p.screen.scale = cameraDepth/dz
        
            //ScreenX = (Ez / dz) * dx + ex
            // p.screen.x = Math.round((p.screen.scale) * dx + (width/2))
            p.screen.x = Math.round((p.screen.scale) * dx)
            //ScreenY = (Ez / dz) * dy + ey
            // p.screen.y = Math.round((p.screen.scale) * dy + (height/2))
            p.screen.y = Math.round((p.screen.scale) * dy)
            p.screen.w     = Math.round(             (p.screen.scale * roadWidth   * width/2))
          

    }
    update(){
        //run all functions in updateArry
        //used to create look at methods, rotate towards, move to, anything that requires more than a single frame to finish
    }
    setPosition(z,y,z){

    }
    setRotation(x,y,z){

    }
    addPosition(axis, amount){

    }
    addRotation(axis, amount){

    }
    follow(ref){

    }
    
}